import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err) {
        logStep("Webhook signature verification failed", { error: err instanceof Error ? err.message : String(err) });
        return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    } else {
      event = JSON.parse(body);
      logStep("Processing without signature verification (development mode)");
    }

    logStep("Event type", { type: event.type });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { sessionId: session.id });

      const userId = session.metadata?.user_id;
      const planId = session.metadata?.plan_id;
      const purchaseType = session.metadata?.purchase_type || 'recharge';
      const rechargeLink = session.metadata?.recharge_link || '';

      if (!userId || !planId) {
        logStep("Missing metadata", { userId, planId });
        return new Response(JSON.stringify({ error: "Missing metadata" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      logStep("Purchase details", { purchaseType, rechargeLink });

      // Get plan details
      const { data: plan, error: planError } = await supabaseAdmin
        .from("credit_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        logStep("Plan not found", { planId, error: planError?.message });
        return new Response(JSON.stringify({ error: "Plan not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      logStep("Plan found", { planName: plan.name, credits: plan.credits });

      // Get current user credits
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("credits, email")
        .eq("id", userId)
        .single();

      if (profileError) {
        logStep("Profile fetch error", { error: profileError.message });
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const newCredits = (profile?.credits || 0) + plan.credits;

      // Update user credits
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ credits: newCredits })
        .eq("id", userId);

      if (updateError) {
        logStep("Credits update error", { error: updateError.message });
        throw updateError;
      }

      logStep("Credits updated", { userId, newCredits });

      // If purchase type is new_account, assign an available account to the user
      let assignedAccountData = null;
      if (purchaseType === 'new_account') {
        // Find an available account for this plan
        const { data: availableAccount, error: accountError } = await supabaseAdmin
          .from("accounts")
          .select("*")
          .eq("plan_id", planId)
          .eq("is_used", false)
          .limit(1)
          .single();

        if (accountError || !availableAccount) {
          logStep("No available account found", { planId, error: accountError?.message });
        } else {
          // Mark account as used
          const { error: markError } = await supabaseAdmin
            .from("accounts")
            .update({ 
              is_used: true, 
              used_by: userId, 
              used_at: new Date().toISOString() 
            })
            .eq("id", availableAccount.id);

          if (markError) {
            logStep("Error marking account as used", { error: markError.message });
          } else {
            assignedAccountData = availableAccount.account_data;
            logStep("Account assigned to user", { accountId: availableAccount.id });
          }
      }
      }

      // If purchase type is recharge, create a recharge request
      if (purchaseType === 'recharge' && rechargeLink) {
        const { error: rechargeError } = await supabaseAdmin
          .from("recharge_requests")
          .insert({
            user_id: userId,
            plan_id: planId,
            recharge_link: rechargeLink,
            status: 'pending',
            credits_added: plan.credits,
          });

        if (rechargeError) {
          logStep("Recharge request error", { error: rechargeError.message });
        } else {
          logStep("Recharge request created successfully");
        }
      }

      // Record the transaction with purchase details
      const { error: txError } = await supabaseAdmin
        .from("payment_transactions")
        .insert({
          user_id: userId,
          plan_id: planId,
          stripe_session_id: session.id,
          status: "completed",
          credits_added: plan.credits,
          amount_cents: session.amount_total || plan.price_cents,
        });

      if (txError) {
        logStep("Transaction record error", { error: txError.message });
      } else {
        logStep("Transaction recorded successfully");
      }

      // Log the assigned account for now (in the future, send email)
      if (assignedAccountData) {
        logStep("Account data to be sent to user", { 
          userEmail: profile?.email,
          accountData: "REDACTED" // Don't log actual account data
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

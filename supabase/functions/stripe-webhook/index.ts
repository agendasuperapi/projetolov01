import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// External sync configuration
const EXTERNAL_SYNC_URL = 'https://adpnzkvzvjbervzrqhhx.supabase.co/functions/v1/sync-unified-data';
const EXTERNAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG56a3Z6dmpiZXJ2enJxaGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MDAzODYsImV4cCI6MjA3OTA3NjM4Nn0.N7gETUDWj95yDCYdZTYWPoMJQcdx_Yjl51jxK-O1vrE';
const PRODUCT_ID = '9453f6dc-5257-43d9-9b04-3bdfd5188ed1';

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Helper function to sync payment to external server
const syncPaymentToExternal = async (paymentData: {
  external_payment_id: string;
  external_user_id: string;
  product_id: string;
  plan_id: string | null;
  amount: number;
  billing_reason: string;
  status: string;
  affiliate_id: string | null;
  affiliate_coupon_id: string | null;
  environment: string;
}) => {
  const syncPayload = {
    action: 'sync_payment',
    payment: paymentData
  };

  logStep('Syncing payment to external server', { external_payment_id: paymentData.external_payment_id });

  const response = await fetch(EXTERNAL_SYNC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EXTERNAL_ANON_KEY}`,
    },
    body: JSON.stringify(syncPayload),
  });

  const responseText = await response.text();
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = { raw: responseText };
  }

  logStep('External payment sync response', { status: response.status, response: responseData });

  return { ok: response.ok, data: responseData };
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

    // Detect environment based on Stripe key
    const stripeKeyPrefix = stripeKey?.substring(0, 8) || '';
    const environment = stripeKeyPrefix === 'sk_live_' ? 'production' : 'test';
    logStep("Environment detected", { environment });

    // Extract metadata from event object
    const eventObject = event.data.object as any;
    const metadata = eventObject.metadata || {};
    const eventEmail = metadata.user_email || eventObject.customer_email || eventObject.email || null;

    // Extract amount fields from event object (available in checkout sessions)
    const amountSubtotal = eventObject.amount_subtotal ?? null;
    const amountTotal = eventObject.amount_total ?? null;
    const totalDiscount = eventObject.total_details?.amount_discount ?? null;

    // Insert event into stripe_events table
    const { error: eventInsertError } = await supabaseAdmin
      .from("stripe_events")
      .insert({
        event_id: event.id,
        event_type: event.type,
        event_data: event.data.object,
        user_id: metadata.user_id || null,
        plan_id: metadata.plan_id || null,
        product_id: PRODUCT_ID,
        email: eventEmail,
        environment: environment,
        affiliate_id: metadata.affiliate_id || null,
        affiliate_coupon_id: metadata.coupon_id || null,
        amount_subtotal: amountSubtotal,
        amount_discount: totalDiscount,
        amount_total: amountTotal,
        processed: false,
        sync_status: 'pending',
      });

    if (eventInsertError) {
      logStep("Error inserting stripe event", { error: eventInsertError.message });
    } else {
      logStep("Stripe event logged successfully");
    }

    // Variables to track sync status
    let syncStatus = 'pending';
    let syncResponse: string | null = null;
    let syncedAt: string | null = null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { sessionId: session.id });

      const userId = session.metadata?.user_id;
      const planId = session.metadata?.plan_id;
      const purchaseType = session.metadata?.purchase_type || 'new_account';

      if (!userId || !planId) {
        logStep("Missing metadata", { userId, planId });
        return new Response(JSON.stringify({ error: "Missing metadata" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      logStep("Purchase details", { purchaseType });

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

      // If purchase type is recharge, create a recharge request with pending_link status
      // The user will provide the recharge link on the success page
      if (purchaseType === 'recharge') {
        const { error: rechargeError } = await supabaseAdmin
          .from("recharge_requests")
          .insert({
            user_id: userId,
            plan_id: planId,
            recharge_link: '', // Will be filled in by user on success page
            status: 'pending_link',
            credits_added: plan.credits,
          });

        if (rechargeError) {
          logStep("Recharge request error", { error: rechargeError.message });
        } else {
          logStep("Recharge request created with pending_link status");
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

      // Sync payment to external server
      try {
        const amountInReais = (session.amount_total || plan.price_cents) / 100;
        
        // Generate a UUID for external_payment_id (external server expects UUID, not Stripe session ID)
        const externalPaymentId = crypto.randomUUID();
        
        // Ensure affiliate fields are proper UUIDs or null (empty strings cause type errors)
        const affiliateId = metadata.affiliate_id && metadata.affiliate_id.trim() !== '' ? metadata.affiliate_id : null;
        const affiliateCouponId = metadata.coupon_id && metadata.coupon_id.trim() !== '' ? metadata.coupon_id : null;
        
        const syncResult = await syncPaymentToExternal({
          external_payment_id: externalPaymentId,
          external_user_id: userId,
          product_id: PRODUCT_ID,
          plan_id: planId,
          amount: amountInReais,
          billing_reason: 'one_time_purchase',
          status: 'paid',
          affiliate_id: affiliateId,
          affiliate_coupon_id: affiliateCouponId,
          environment: environment,
        });

        syncStatus = syncResult.ok ? 'synced' : 'error';
        syncResponse = JSON.stringify(syncResult.data);
        syncedAt = new Date().toISOString();

        if (syncResult.ok) {
          logStep('Payment synced to external server successfully');
        } else {
          logStep('Payment sync to external server failed', { response: syncResult.data });
        }
      } catch (syncError) {
        syncStatus = 'error';
        syncResponse = syncError instanceof Error ? syncError.message : String(syncError);
        syncedAt = new Date().toISOString();
        logStep('Error syncing payment to external server', { error: syncResponse });
        // Don't throw - we don't want to fail the webhook if sync fails
      }

      // Log the assigned account for now (in the future, send email)
      if (assignedAccountData) {
        logStep("Account data to be sent to user", { 
          userEmail: profile?.email,
          accountData: "REDACTED" // Don't log actual account data
        });
      }
    }

    // Mark event as processed and update sync status
    await supabaseAdmin
      .from("stripe_events")
      .update({ 
        processed: true,
        sync_status: syncStatus,
        sync_response: syncResponse,
        synced_at: syncedAt,
      })
      .eq("event_id", event.id);

    logStep("Event marked as processed", { syncStatus });

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

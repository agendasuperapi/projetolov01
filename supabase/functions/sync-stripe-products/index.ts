import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-STRIPE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      throw new Error("User is not an admin");
    }

    logStep("Admin verified", { userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch all products from Stripe
    const products = await stripe.products.list({ active: true, limit: 100 });
    logStep("Fetched Stripe products", { count: products.data.length });

    // Fetch all prices from Stripe
    const prices = await stripe.prices.list({ active: true, limit: 100 });
    logStep("Fetched Stripe prices", { count: prices.data.length });

    const syncResults: any[] = [];

    for (const product of products.data) {
      // Find prices for this product
      const productPrices = prices.data.filter((p: Stripe.Price) => p.product === product.id);
      
      if (productPrices.length === 0) {
        logStep("Product has no prices, skipping", { productId: product.id, name: product.name });
        continue;
      }

      // Use the first active price (usually the main one)
      const price = productPrices[0];
      
      // Extract credits from product name or metadata
      let credits = 0;
      const creditsMatch = product.name.match(/(\d+)\s*cr[eé]ditos?/i);
      if (creditsMatch) {
        credits = parseInt(creditsMatch[1], 10);
      } else if (product.metadata?.credits) {
        credits = parseInt(product.metadata.credits, 10);
      }

      const priceInCents = price.unit_amount || 0;
      const stripePriceId = price.id;

      logStep("Processing product", { 
        name: product.name, 
        credits, 
        priceInCents, 
        stripePriceId 
      });

      // Check if plan already exists with this stripe_price_id
      const { data: existingPlan } = await supabaseClient
        .from("credit_plans")
        .select("*")
        .eq("stripe_price_id", stripePriceId)
        .single();

      if (existingPlan) {
        // Update existing plan
        const { error: updateError } = await supabaseClient
          .from("credit_plans")
          .update({
            name: product.name,
            credits: credits,
            price_cents: priceInCents,
            active: true
          })
          .eq("id", existingPlan.id);

        if (updateError) {
          logStep("Error updating plan", { error: updateError.message });
          syncResults.push({ 
            action: "error", 
            name: product.name, 
            error: updateError.message 
          });
        } else {
          syncResults.push({ 
            action: "updated", 
            name: product.name, 
            credits, 
            priceInCents 
          });
        }
      } else {
        // Check if plan exists with same name
        const { data: existingByName } = await supabaseClient
          .from("credit_plans")
          .select("*")
          .eq("name", product.name)
          .single();

        if (existingByName) {
          // Update existing plan with stripe_price_id
          const { error: updateError } = await supabaseClient
            .from("credit_plans")
            .update({
              stripe_price_id: stripePriceId,
              credits: credits || existingByName.credits,
              price_cents: priceInCents || existingByName.price_cents,
              active: true
            })
            .eq("id", existingByName.id);

          if (updateError) {
            logStep("Error linking plan", { error: updateError.message });
            syncResults.push({ 
              action: "error", 
              name: product.name, 
              error: updateError.message 
            });
          } else {
            syncResults.push({ 
              action: "linked", 
              name: product.name, 
              stripePriceId 
            });
          }
        } else if (credits > 0) {
          // Create new plan
          const { error: insertError } = await supabaseClient
            .from("credit_plans")
            .insert({
              name: product.name,
              credits: credits,
              price_cents: priceInCents,
              stripe_price_id: stripePriceId,
              active: true
            });

          if (insertError) {
            logStep("Error creating plan", { error: insertError.message });
            syncResults.push({ 
              action: "error", 
              name: product.name, 
              error: insertError.message 
            });
          } else {
            syncResults.push({ 
              action: "created", 
              name: product.name, 
              credits, 
              priceInCents 
            });
          }
        } else {
          syncResults.push({ 
            action: "skipped", 
            name: product.name, 
            reason: "Could not determine credits amount" 
          });
        }
      }
    }

    logStep("Sync completed", { results: syncResults });

    return new Response(JSON.stringify({ 
      success: true, 
      results: syncResults,
      message: `Synced ${syncResults.filter(r => r.action !== 'error' && r.action !== 'skipped').length} products`
    }), {
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

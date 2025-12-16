import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

interface CouponData {
  coupon_id: string;
  code: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed';
  value: number;
  is_active: boolean;
  product_id: string;
  affiliate_coupon_id: string;
  affiliate_id: string;
  affiliate_name: string;
  affiliate_avatar_url: string;
  custom_code: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Admin client for operations that need to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { priceId, planId, purchaseType, couponCode } = await req.json();
    if (!priceId || !planId) throw new Error("priceId and planId are required");
    if (!purchaseType) throw new Error("purchaseType is required");
    logStep("Request body parsed", { priceId, planId, purchaseType, couponCode });

    // Fetch user profile for coupon data fallback (using admin client to bypass RLS)
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('last_coupon_code, last_affiliate_id, last_affiliate_coupon_id')
      .eq('id', user.id)
      .maybeSingle();
    
    if (profileError) {
      logStep("Error fetching profile", { error: profileError.message });
    } else {
      logStep("Profile coupon data fetched", { 
        last_coupon_code: profileData?.last_coupon_code,
        last_affiliate_id: profileData?.last_affiliate_id,
        last_affiliate_coupon_id: profileData?.last_affiliate_coupon_id
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Coupon handling
    let couponMetadata: {
      coupon_id: string | null;
      coupon_code: string | null;
      affiliate_id: string | null;
      affiliate_product_id: string | null;
    } = {
      coupon_id: null,
      coupon_code: null,
      affiliate_id: null,
      affiliate_product_id: '9453f6dc-5257-43d9-9b04-3bdfd5188ed1',
    };
    let stripeCouponId: string | null = null;

    if (couponCode) {
      logStep("Validating coupon", { couponCode });
      
      try {
        const couponResponse = await fetch(
          'https://adpnzkvzvjbervzrqhhx.supabase.co/rest/v1/rpc/validate_coupon',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG56a3Z6dmpiZXJ2enJxaGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MDAzODYsImV4cCI6MjA3OTA3NjM4Nn0.N7gETUDWj95yDCYdZTYWPoMJQcdx_Yjl51jxK-O1vrE',
            },
            body: JSON.stringify({ 
              p_coupon_code: couponCode,
              p_product_id: '9453f6dc-5257-43d9-9b04-3bdfd5188ed1'
            }),
          }
        );
        
        const responseData = await couponResponse.json();
        // API returns an array, get the first item
        const couponData: CouponData | null = Array.isArray(responseData) ? responseData[0] : responseData;
        logStep("Coupon API response", { couponData });

        if (couponData && couponData.coupon_id && couponData.is_active) {
          // Try to retrieve existing Stripe coupon or create new one
          try {
            const existingCoupon = await stripe.coupons.retrieve(couponData.coupon_id);
            stripeCouponId = existingCoupon.id;
            logStep("Found existing Stripe coupon", { stripeCouponId });
          } catch {
            // Coupon doesn't exist in Stripe, create it
            const newCoupon = await stripe.coupons.create({
              id: couponData.coupon_id,
              percent_off: couponData.type === 'percentage' ? couponData.value : undefined,
              amount_off: couponData.type === 'fixed' ? couponData.value * 100 : undefined,
              currency: couponData.type === 'fixed' ? 'brl' : undefined,
              name: couponData.name,
            });
            stripeCouponId = newCoupon.id;
            logStep("Created new Stripe coupon", { stripeCouponId });
          }

          couponMetadata = {
            coupon_id: couponData.affiliate_coupon_id,
            coupon_code: couponData.custom_code || couponData.code,
            affiliate_id: couponData.affiliate_id,
            affiliate_product_id: couponData.product_id,
          };
          logStep("Coupon metadata set", couponMetadata);
        } else {
          logStep("Coupon not valid or not active", { couponData });
        }
      } catch (couponError) {
        logStep("Error validating coupon", { error: String(couponError) });
        // Continue without coupon if validation fails
      }
    }

    // Fallback to profile coupon data if no coupon was applied from request
    if (!couponMetadata.coupon_id && profileData) {
      if (profileData.last_affiliate_coupon_id || profileData.last_affiliate_id || profileData.last_coupon_code) {
        couponMetadata = {
          coupon_id: profileData.last_affiliate_coupon_id,
          coupon_code: profileData.last_coupon_code,
          affiliate_id: profileData.last_affiliate_id,
          affiliate_product_id: '9453f6dc-5257-43d9-9b04-3bdfd5188ed1',
        };
        logStep("Using profile coupon data for metadata (no discount applied)", couponMetadata);
      }
    }

    const origin = req.headers.get("origin") || "https://lovableproject.com";
    
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded",
      return_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        user_id: user.id,
        plan_id: planId,
        purchase_type: purchaseType,
        coupon_id: couponMetadata.coupon_id,
        coupon_code: couponMetadata.coupon_code,
        affiliate_id: couponMetadata.affiliate_id,
        affiliate_product_id: couponMetadata.affiliate_product_id,
      },
      // Customização visual do checkout
      appearance: {
        theme: 'flat',
        variables: {
          colorPrimary: '#7c3aed', // Primary purple (HSL 250 84% 54%)
          colorBackground: '#ffffff',
          colorText: '#1f2937',
          colorDanger: '#ef4444',
          colorSuccess: '#22c55e',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSizeBase: '16px',
          spacingUnit: '4px',
          borderRadius: '12px',
        },
        rules: {
          '.Input': {
            border: '1px solid #e5e7eb',
            boxShadow: 'none',
          },
          '.Input:focus': {
            border: '2px solid #7c3aed',
            boxShadow: '0 0 0 3px rgba(124, 58, 237, 0.1)',
          },
          '.Label': {
            fontWeight: '500',
          },
          '.Tab': {
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          },
          '.Tab--selected': {
            backgroundColor: '#7c3aed',
            borderColor: '#7c3aed',
          },
        },
      },
    };

    // Add discount if coupon is valid
    if (stripeCouponId) {
      sessionConfig.discounts = [{ coupon: stripeCouponId }];
      logStep("Discount applied to session", { stripeCouponId });
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    logStep("Checkout session created", { sessionId: session.id, clientSecret: session.client_secret });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// External Server B configuration
const EXTERNAL_SYNC_URL = 'https://adpnzkvzvjbervzrqhhx.supabase.co/functions/v1/sync-plans';
const EXTERNAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG56a3Z6dmpiZXJ2enJxaGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MDAzODYsImV4cCI6MjA3OTA3NjM4Nn0.N7gETUDWj95yDCYdZTYWPoMJQcdx_Yjl51jxK-O1vrE';
const PRODUCT_ID = '9453f6dc-5257-43d9-9b04-3bdfd5188ed1';

const logStep = (step: string, data?: any) => {
  console.info(`[SYNC-PLANS-EXTERNAL] ${step}`, data ? JSON.stringify(data) : '');
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action, plan_id } = body;

    logStep('Request body parsed', { action, plan_id });

    if (!action) {
      throw new Error('Missing required field: action');
    }

    let plansToSync: any[] = [];

    if (action === 'sync_plan') {
      // Sync a single plan
      if (!plan_id) {
        throw new Error('Missing required field: plan_id for sync_plan action');
      }

      const { data: plan, error } = await supabaseAdmin
        .from('credit_plans')
        .select('*')
        .eq('id', plan_id)
        .maybeSingle();

      if (error) throw error;
      if (!plan) throw new Error(`Plan not found: ${plan_id}`);

      plansToSync = [plan];
      logStep('Single plan fetched', { planId: plan_id, planName: plan.name });

    } else if (action === 'sync_all') {
      // Sync all active plans
      const { data: plans, error } = await supabaseAdmin
        .from('credit_plans')
        .select('*')
        .eq('active', true)
        .order('credits', { ascending: true });

      if (error) throw error;
      
      plansToSync = plans || [];
      logStep('All active plans fetched', { count: plansToSync.length });

    } else {
      throw new Error(`Invalid action: ${action}. Use 'sync_plan' or 'sync_all'`);
    }

    if (plansToSync.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No plans to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare payload for external server
    const externalAction = plansToSync.length === 1 ? 'sync_plan' : 'sync_plans';
    const payload: any = {
      action: externalAction,
      product_id: PRODUCT_ID,
    };

    if (externalAction === 'sync_plan') {
      const plan = plansToSync[0];
      payload.plan = {
        id: plan.id,
        name: plan.name,
        price_cents: plan.price_cents,
        credits: plan.credits,
        stripe_price_id: plan.stripe_price_id,
        active: plan.active,
        competitor_price_cents: plan.competitor_price_cents,
        plan_type: plan.plan_type,
      };
    } else {
      payload.plans = plansToSync.map(plan => ({
        id: plan.id,
        name: plan.name,
        price_cents: plan.price_cents,
        credits: plan.credits,
        stripe_price_id: plan.stripe_price_id,
        active: plan.active,
        competitor_price_cents: plan.competitor_price_cents,
        plan_type: plan.plan_type,
      }));
    }

    logStep('Sending to external server', { 
      action: externalAction, 
      plansCount: plansToSync.length,
      planIds: plansToSync.map(p => p.id)
    });

    // Send to external server
    const externalResponse = await fetch(EXTERNAL_SYNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EXTERNAL_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const externalResult = await externalResponse.json();

    logStep('External server response', { 
      status: externalResponse.status, 
      result: externalResult 
    });

    if (!externalResponse.ok) {
      throw new Error(`External sync failed: ${externalResult.error || 'Unknown error'}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${plansToSync.length} plan(s) to external server`,
        external_response: externalResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SYNC-PLANS-EXTERNAL] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTERNAL_SYNC_URL = 'https://adpnzkvzvjbervzrqhhx.supabase.co/functions/v1/sync-unified-data';
const EXTERNAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG56a3Z6dmpiZXJ2enJxaGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MDAzODYsImV4cCI6MjA3OTA3NjM4Nn0.N7gETUDWj95yDCYdZTYWPoMJQcdx_Yjl51jxK-O1vrE';
const PRODUCT_ID = '9453f6dc-5257-43d9-9b04-3bdfd5188ed1';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event_id } = await req.json();

    if (!event_id) {
      throw new Error('event_id is required');
    }

    console.log('🔄 Retrying sync for event:', event_id);

    // Buscar dados do evento
    const { data: stripeEvent, error: eventError } = await supabase
      .from('stripe_events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError || !stripeEvent) {
      throw new Error(`Event not found: ${eventError?.message || 'Unknown error'}`);
    }

    console.log('📋 Event data:', stripeEvent.event_type, stripeEvent.email);

    // Verificar se é um evento de checkout completed
    if (stripeEvent.event_type !== 'checkout.session.completed') {
      throw new Error('Only checkout.session.completed events can be synced');
    }

    // Extrair dados necessários do evento
    const eventData = stripeEvent.event_data as any;
    const session = eventData?.data?.object || eventData;
    const metadata = session?.metadata || {};

    const userId = stripeEvent.user_id || metadata.user_id;
    const planId = stripeEvent.plan_id || metadata.plan_id;
    const affiliateId = stripeEvent.affiliate_id || (metadata.affiliate_id && metadata.affiliate_id.trim() !== '' ? metadata.affiliate_id : null);
    const affiliateCouponId = stripeEvent.affiliate_coupon_id || (metadata.coupon_id && metadata.coupon_id.trim() !== '' ? metadata.coupon_id : null);
    const amountTotal = stripeEvent.amount_total || session?.amount_total || 0;
    const amountInReais = amountTotal / 100;

    if (!userId) {
      throw new Error('user_id not found in event');
    }

    console.log('📦 Sync payload:', { userId, planId, amountInReais, affiliateId, affiliateCouponId });

    // Gerar novo UUID para o pagamento externo
    const externalPaymentId = crypto.randomUUID();

    // Preparar payload para sincronização
    const syncPayload = {
      action: 'sync_payment',
      payment: {
        external_payment_id: externalPaymentId,
        external_user_id: userId,
        product_id: PRODUCT_ID,
        plan_id: planId,
        amount: amountInReais,
        billing_reason: 'one_time_purchase',
        status: 'paid',
        affiliate_id: affiliateId,
        affiliate_coupon_id: affiliateCouponId,
        environment: stripeEvent.environment || 'test',
      }
    };

    console.log('🚀 Calling external sync...');

    // Chamar edge function externa
    const externalResponse = await fetch(EXTERNAL_SYNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EXTERNAL_ANON_KEY}`,
      },
      body: JSON.stringify(syncPayload),
    });

    const responseText = await externalResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log('📨 External sync response:', externalResponse.status, responseData);

    // Atualizar status de sincronização no stripe_events
    const syncStatus = externalResponse.ok ? 'synced' : 'error';
    const syncResponse = JSON.stringify(responseData);

    const { error: updateError } = await supabase
      .from('stripe_events')
      .update({
        sync_status: syncStatus,
        sync_response: syncResponse,
        synced_at: new Date().toISOString(),
      })
      .eq('id', event_id);

    if (updateError) {
      console.error('❌ Error updating sync status:', updateError);
    }

    if (!externalResponse.ok) {
      throw new Error(`External sync failed: ${syncResponse}`);
    }

    console.log('✅ Sync completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Payment synced successfully',
      sync_response: responseData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error in retry-payment-sync:', error);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

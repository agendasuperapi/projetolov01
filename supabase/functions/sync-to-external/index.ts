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

    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log('Syncing user to external server:', user_id);

    // Buscar dados do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      throw new Error(`Profile not found: ${profileError?.message || 'Unknown error'}`);
    }

    // Buscar role do usuário
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (roleError) {
      console.error('Error fetching user role:', roleError);
    }

    // Buscar plano do usuário (se tiver alguma transação)
    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select('plan_id')
      .eq('user_id', user_id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Preparar payload para sincronização
    const syncPayload = {
      action: 'sync_user',
      user: {
        external_user_id: user_id,
        product_id: PRODUCT_ID,
        email: profile.email,
        name: profile.name,
        phone: profile.phone || '',
        plan_id: transaction?.plan_id || null,
      }
    };

    console.log('Sync payload:', JSON.stringify(syncPayload));

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

    console.log('External sync response:', externalResponse.status, responseData);

    // Atualizar status de sincronização na tabela user_roles
    const syncStatus = externalResponse.ok ? 'synced' : 'error';
    const syncResponse = JSON.stringify(responseData);

    if (userRole) {
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({
          sync_status: syncStatus,
          sync_response: syncResponse,
          synced_at: new Date().toISOString(),
        })
        .eq('user_id', user_id);

      if (updateError) {
        console.error('Error updating sync status:', updateError);
      }
    }

    if (!externalResponse.ok) {
      throw new Error(`External sync failed: ${syncResponse}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'User synced successfully',
      sync_response: responseData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in sync-to-external:', error);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

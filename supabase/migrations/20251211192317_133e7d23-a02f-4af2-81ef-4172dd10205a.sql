-- Add sync_payload column to stripe_events table
ALTER TABLE public.stripe_events 
ADD COLUMN sync_payload jsonb DEFAULT NULL;

COMMENT ON COLUMN public.stripe_events.sync_payload IS 
'Payload completo enviado para sincronização com servidor externo';
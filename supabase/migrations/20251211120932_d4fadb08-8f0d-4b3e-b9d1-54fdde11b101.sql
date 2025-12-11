-- Add sync tracking columns to stripe_events table
ALTER TABLE public.stripe_events
ADD COLUMN sync_status text DEFAULT 'pending',
ADD COLUMN sync_response text,
ADD COLUMN synced_at timestamp with time zone;
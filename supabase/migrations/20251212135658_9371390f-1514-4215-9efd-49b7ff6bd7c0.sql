-- Add sync tracking columns to credit_plans table
ALTER TABLE public.credit_plans
ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'pending'::text,
ADD COLUMN IF NOT EXISTS sync_response text,
ADD COLUMN IF NOT EXISTS synced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS sync_payload jsonb;
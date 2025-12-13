-- Add stripe_session_id column to recharge_requests table
ALTER TABLE public.recharge_requests 
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
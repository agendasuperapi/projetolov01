-- Add amount columns to stripe_events table
ALTER TABLE public.stripe_events
ADD COLUMN amount_subtotal integer,
ADD COLUMN amount_discount integer,
ADD COLUMN amount_total integer;
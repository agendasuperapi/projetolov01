-- Create stripe_events table to log all Stripe webhook events
CREATE TABLE public.stripe_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  processed boolean NULL DEFAULT false,
  created_at timestamp with time zone NULL DEFAULT now(),
  user_id uuid NULL,
  plan_id uuid NULL,
  product_id uuid NULL DEFAULT '9453f6dc-5257-43d9-9b04-3bdfd5188ed1'::uuid,
  email text NULL,
  environment text NULL DEFAULT 'test'::text,
  affiliate_id uuid NULL,
  affiliate_coupon_id uuid NULL
);

-- Create index on event_id for faster lookups
CREATE INDEX idx_stripe_events_event_id ON public.stripe_events(event_id);

-- Create index on created_at for time-based queries
CREATE INDEX idx_stripe_events_created_at ON public.stripe_events(created_at DESC);

-- Create index on event_type for filtering
CREATE INDEX idx_stripe_events_event_type ON public.stripe_events(event_type);

-- Enable Row Level Security
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view stripe events
CREATE POLICY "Admins can view stripe events"
ON public.stripe_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can manage stripe events
CREATE POLICY "Admins can manage stripe events"
ON public.stripe_events
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));
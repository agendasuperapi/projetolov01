-- Add separate columns for test and live Stripe price IDs
ALTER TABLE public.credit_plans
ADD COLUMN IF NOT EXISTS stripe_price_id_test TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id_live TEXT;

-- Migrate existing stripe_price_id to stripe_price_id_test (assuming current IDs are from test mode)
UPDATE public.credit_plans
SET stripe_price_id_test = stripe_price_id
WHERE stripe_price_id IS NOT NULL AND stripe_price_id_test IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.credit_plans.stripe_price_id_test IS 'Stripe Price ID for test/sandbox environment';
COMMENT ON COLUMN public.credit_plans.stripe_price_id_live IS 'Stripe Price ID for live/production environment';
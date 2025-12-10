-- Duplicate existing plans for recharge type
INSERT INTO public.credit_plans (name, credits, price_cents, stripe_price_id, competitor_price_cents, active, plan_type)
SELECT 
  name || ' (Recarga)',
  credits,
  price_cents,
  NULL, -- stripe_price_id needs to be configured separately for recharge
  competitor_price_cents,
  active,
  'recharge'
FROM public.credit_plans
WHERE plan_type = 'new_account';
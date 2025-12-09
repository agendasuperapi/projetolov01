-- Adicionar coluna de preço do concorrente em cada plano
ALTER TABLE public.credit_plans
ADD COLUMN competitor_price_cents integer DEFAULT 0;
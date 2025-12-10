-- Add plan_type column to credit_plans to separate new account plans from recharge plans
ALTER TABLE public.credit_plans 
ADD COLUMN plan_type text NOT NULL DEFAULT 'new_account' 
CHECK (plan_type IN ('new_account', 'recharge'));
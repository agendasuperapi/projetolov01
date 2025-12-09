-- Add foreign key for plan_id to credit_plans
ALTER TABLE public.recharge_requests
ADD CONSTRAINT recharge_requests_plan_id_fkey
FOREIGN KEY (plan_id) REFERENCES public.credit_plans(id);
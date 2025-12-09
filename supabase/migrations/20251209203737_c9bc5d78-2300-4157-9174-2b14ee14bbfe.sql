-- Create table for pre-registered accounts
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.credit_plans(id) ON DELETE CASCADE,
  account_data TEXT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID REFERENCES public.profiles(id),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Admins can manage accounts
CREATE POLICY "Admins can manage accounts"
ON public.accounts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own used accounts
CREATE POLICY "Users can view own accounts"
ON public.accounts
FOR SELECT
USING (used_by = auth.uid());

-- Create function to get available account count per plan
CREATE OR REPLACE FUNCTION public.get_available_accounts_count(p_plan_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.accounts
  WHERE plan_id = p_plan_id AND is_used = false
$$;
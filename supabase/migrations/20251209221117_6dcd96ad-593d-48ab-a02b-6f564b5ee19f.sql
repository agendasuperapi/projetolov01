-- Create recharge_requests table
CREATE TABLE public.recharge_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  recharge_link TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  credits_added INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.recharge_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own recharge requests
CREATE POLICY "Users can view own recharge requests"
ON public.recharge_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can manage all recharge requests
CREATE POLICY "Admins can manage recharge requests"
ON public.recharge_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));
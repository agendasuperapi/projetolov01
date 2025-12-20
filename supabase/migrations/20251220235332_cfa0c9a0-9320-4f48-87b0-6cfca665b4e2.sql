-- Create table for storing Stripe environment mode
CREATE TABLE IF NOT EXISTS public.stripe_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.stripe_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view
CREATE POLICY "Admins can view stripe settings"
ON public.stripe_settings
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admins can update stripe settings"
ON public.stripe_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert
CREATE POLICY "Admins can insert stripe settings"
ON public.stripe_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default settings (test mode)
INSERT INTO public.stripe_settings (mode) VALUES ('test');
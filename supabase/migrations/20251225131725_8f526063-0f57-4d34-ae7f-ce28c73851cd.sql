-- Enable RLS on stripe_settings if not already enabled
ALTER TABLE public.stripe_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read stripe settings (just the mode, no sensitive data)
CREATE POLICY "Allow public read access to stripe_settings"
ON public.stripe_settings
FOR SELECT
USING (true);
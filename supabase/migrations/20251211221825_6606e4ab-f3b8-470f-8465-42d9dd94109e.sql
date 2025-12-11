-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function that syncs user to external server on profile update
CREATE OR REPLACE FUNCTION public.sync_user_on_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_role_key TEXT;
BEGIN
  -- Only sync if relevant fields changed
  IF (OLD.name IS DISTINCT FROM NEW.name OR 
      OLD.email IS DISTINCT FROM NEW.email OR 
      OLD.phone IS DISTINCT FROM NEW.phone) THEN
    
    -- Get service role key from vault or use hardcoded for now
    -- Note: We'll use the anon key since service role isn't accessible in triggers
    PERFORM net.http_post(
      url := 'https://wzdqarazpikspxnrbemt.supabase.co/functions/v1/sync-to-external',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6ZHFhcmF6cGlrc3B4bnJiZW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTMwMzEsImV4cCI6MjA4MDg2OTAzMX0.D72XnaayvWFx3hZ-CfEZXCNopBnbIw2FzP2S-FP8PEw'
      ),
      body := jsonb_build_object('user_id', NEW.id::text)
    );
    
    RAISE LOG 'Profile update triggered sync for user: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table for updates
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;

CREATE TRIGGER on_profile_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_on_profile_update();

-- Add comment for documentation
COMMENT ON FUNCTION public.sync_user_on_profile_update() IS 'Automatically syncs user data to external server when profile is updated';
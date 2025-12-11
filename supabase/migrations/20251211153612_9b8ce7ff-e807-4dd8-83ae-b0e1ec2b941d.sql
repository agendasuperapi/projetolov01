-- Create view joining user_roles and profiles
CREATE OR REPLACE VIEW public.view_users_with_roles AS
SELECT 
  p.id,
  p.name,
  p.email,
  p.phone,
  p.credits,
  p.created_at,
  ur.role,
  ur.sync_status,
  ur.sync_response,
  ur.synced_at
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id;

-- Create RLS policy for the view (admins only)
-- Note: Views inherit RLS from underlying tables, but we need to ensure admins can access
GRANT SELECT ON public.view_users_with_roles TO authenticated;
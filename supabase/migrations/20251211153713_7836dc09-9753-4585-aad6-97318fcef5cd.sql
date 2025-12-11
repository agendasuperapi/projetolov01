-- Recreate view without SECURITY DEFINER
DROP VIEW IF EXISTS public.view_users_with_roles;

CREATE VIEW public.view_users_with_roles 
WITH (security_invoker = true) AS
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

GRANT SELECT ON public.view_users_with_roles TO authenticated;
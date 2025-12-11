-- Adicionar campos de sincronização na tabela user_roles
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS sync_response text,
ADD COLUMN IF NOT EXISTS synced_at timestamp with time zone;
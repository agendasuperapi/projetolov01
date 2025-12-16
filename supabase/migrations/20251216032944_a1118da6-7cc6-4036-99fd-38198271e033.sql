-- Função para checar se um email já existe em public.profiles (case-insensitive)
-- Usada no fluxo de login para diferenciar "email não cadastrado" vs "senha incorreta"
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(email) = lower(p_email)
  );
$$;

-- Segurança: restringe execução a clients (anon/authenticated)
REVOKE ALL ON FUNCTION public.check_email_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO authenticated;
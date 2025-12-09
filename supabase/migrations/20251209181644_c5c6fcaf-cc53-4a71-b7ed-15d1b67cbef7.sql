-- Create table for editable site content
CREATE TABLE public.site_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key text NOT NULL UNIQUE,
  content jsonb NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read content (public landing page)
CREATE POLICY "Anyone can view site content"
ON public.site_content
FOR SELECT
USING (true);

-- Only admins can manage content
CREATE POLICY "Admins can manage site content"
ON public.site_content
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default content
INSERT INTO public.site_content (section_key, content) VALUES
('hero', '{
  "badge": "Produtos digitais premium",
  "title": "Acesse produtos digitais",
  "titleHighlight": "com créditos",
  "description": "Compre créditos e tenha acesso à nossa biblioteca completa de produtos digitais exclusivos. Simples, rápido e seguro.",
  "ctaButton": "Ver Planos",
  "secondaryButton": "Criar Conta Grátis"
}'::jsonb),
('features', '{
  "items": [
    {"icon": "Zap", "title": "Acesso Instantâneo", "description": "Download imediato após a compra"},
    {"icon": "Shield", "title": "Pagamento Seguro", "description": "Transações protegidas por Stripe"},
    {"icon": "Download", "title": "Downloads Ilimitados", "description": "Baixe quantas vezes precisar"}
  ]
}'::jsonb),
('plans', '{
  "title": "Escolha seu plano",
  "subtitle": "Quanto mais créditos, mais economia",
  "features": ["Acesso à biblioteca completa", "Download instantâneo", "Suporte prioritário", "Atualizações incluídas"]
}'::jsonb),
('footer', '{
  "copyright": "© 2024 CreditsHub. Todos os direitos reservados."
}'::jsonb);
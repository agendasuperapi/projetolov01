-- Create storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for support attachments
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'support-attachments');

CREATE POLICY "Anyone can view support attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'support-attachments');

CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'support-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add attachment_url column to support_messages
ALTER TABLE public.support_messages
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Create quick_reply_templates table for admin
CREATE TABLE IF NOT EXISTS public.quick_reply_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'geral',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_reply_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage templates"
ON public.quick_reply_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert some default templates
INSERT INTO public.quick_reply_templates (title, content, category) VALUES
('Saudação', 'Olá! Obrigado por entrar em contato. Como posso ajudá-lo?', 'geral'),
('Solicitação de informações', 'Para dar andamento ao seu chamado, preciso de algumas informações adicionais. Poderia me informar...', 'geral'),
('Problema resolvido', 'Fico feliz em informar que seu problema foi resolvido! Se tiver mais alguma dúvida, estou à disposição.', 'fechamento'),
('Aguardando resposta', 'Estou aguardando seu retorno para dar continuidade ao atendimento. Por favor, responda quando possível.', 'geral'),
('Agradecimento', 'Obrigado por utilizar nosso suporte! Caso precise de mais ajuda, estaremos à disposição.', 'fechamento')
ON CONFLICT DO NOTHING;
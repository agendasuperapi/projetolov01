UPDATE site_content 
SET content = '{"copyright": "© 2025  Creditos. Todos os direitos reservados."}'::jsonb,
    updated_at = now()
WHERE section_key = 'footer';
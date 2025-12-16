UPDATE site_content 
SET content = jsonb_set(content::jsonb, '{copyright}', '"© 2025 Mais Créditos. Todos os direitos reservados."')
WHERE section_key = 'footer';
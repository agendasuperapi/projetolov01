UPDATE site_content 
SET content = jsonb_set(content, '{title}', '"Não deixe seus projetos parados."'),
    updated_at = now()
WHERE section_key = 'hero';
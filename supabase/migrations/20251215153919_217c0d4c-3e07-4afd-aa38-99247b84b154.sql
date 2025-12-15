UPDATE site_content 
SET content = jsonb_set(content, '{titleHighlight}', '""'),
    updated_at = now()
WHERE section_key = 'hero';
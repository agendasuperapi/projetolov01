UPDATE site_content 
SET content = jsonb_set(content::jsonb, '{description}', '"Compre créditos em Reais muito mais barato e coloque seus projetos para rodar. Simples, rápido e seguro."')
WHERE section_key = 'hero';
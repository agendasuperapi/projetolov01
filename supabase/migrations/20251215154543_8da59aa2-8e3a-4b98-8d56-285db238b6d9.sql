UPDATE site_content 
SET content = jsonb_set(
  content, 
  '{items}', 
  '[{"description":"Envio imediato após a compra","icon":"Zap","title":"Acesso Instantâneo"},{"description":"Transações protegidas por Stripe","icon":"Shield","title":"Pagamento Seguro"},{"description":"Créditos em conta nova ou na própria conta","icon":"Wallet","title":"Flexibilidade Total"}]'::jsonb
),
updated_at = now()
WHERE section_key = 'features';
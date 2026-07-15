DO $$
DECLARE
  v_campanha_id uuid := '88df9c40-a132-47eb-af27-480b6e28779f';
  v_tema_id uuid := '2a5763ff-6c20-45d8-92b9-4d0846e5399f';
  v_item1 uuid;
  v_item2 uuid;
BEGIN
  INSERT INTO base_conhecimento_itens (campanha_id, tema_id, titulo, descricao)
  VALUES (
    v_campanha_id, v_tema_id,
    'Código Eleitoral Anotado e Legislação Complementar — 17ª edição (TSE, 2026)',
    'Compêndio oficial do TSE: Código Eleitoral anotado + legislação complementar, edição comemorativa dos 30 anos da urna eletrônica. 1347 páginas — referência completa.'
  )
  RETURNING id INTO v_item1;

  INSERT INTO base_conhecimento_arquivos (item_id, campanha_id, arquivo_path, arquivo_nome_original)
  VALUES (
    v_item1, v_campanha_id,
    '88df9c40-a132-47eb-af27-480b6e28779f/2a5763ff-6c20-45d8-92b9-4d0846e5399f/1784074519953-codigo-eleitoral-anotado-tse-2026.pdf',
    'Codigo_Eleitoral_2026_SEPRev30_OK.pdf'
  );

  INSERT INTO base_conhecimento_itens (campanha_id, tema_id, titulo, descricao)
  VALUES (
    v_campanha_id, v_tema_id,
    'Código Eleitoral — Lei nº 4.737/1965 (atualizado até abril/2023)',
    'Texto da Lei nº 4.737/1965 (Código Eleitoral), edição atualizada até abril de 2023. 130 páginas — versão mais enxuta pra consulta rápida do texto de lei em si.'
  )
  RETURNING id INTO v_item2;

  INSERT INTO base_conhecimento_arquivos (item_id, campanha_id, arquivo_path, arquivo_nome_original)
  VALUES (
    v_item2, v_campanha_id,
    '88df9c40-a132-47eb-af27-480b6e28779f/2a5763ff-6c20-45d8-92b9-4d0846e5399f/1784077505979-codigo-eleitoral-lei-4737-1965.pdf',
    'Codigo_eleitoral.pdf'
  );

  RAISE NOTICE 'item1=%, item2=%', v_item1, v_item2;
END $$;

SELECT bi.titulo, ba.arquivo_nome_original
FROM base_conhecimento_itens bi
JOIN base_conhecimento_arquivos ba ON ba.item_id = bi.id
WHERE bi.tema_id = '2a5763ff-6c20-45d8-92b9-4d0846e5399f'
ORDER BY bi.created_at DESC
LIMIT 2;

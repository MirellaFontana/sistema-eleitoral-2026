# Manual do Usuário — Guia de Acesso

## Como acessar o manual

O manual completo do sistema está disponível em:

**URL:** `https://eleito.online/manual` (produção) ou `http://localhost:3001/manual` (desenvolvimento)

O manual é **público** — não requer autenticação para ser acessado.

## Conteúdo

O manual cobre 12 seções principais:

1. **Introdução** — Visão geral da plataforma e papéis do sistema
2. **Acesso ao Sistema** — Login, primeiro acesso, recuperação de senha, navegação
3. **Sala de Decisão** — Tela inicial com 4 quadrantes de resumo
4. **Estratégia** — Decisões, Recomendações geradas por IA
5. **Administração** — Cadastro de campanha, Usuários, Funções, Auditoria, Quarentena, Retenção
6. **Cadastros** — Eleitores, Apoiadores, Lideranças
7. **Gestão** — Tarefas, Agenda, Escuta de campo, Demandas, Mapa
8. **Comunicação** — Mensagens, Modelos, Avisos internos, Respostas com IA
9. **Jurídico** — Tira-dúvidas jurídico, Dossiê, Calendário eleitoral
10. **Inteligência** — Diretrizes, Monitoramento, Denúncias, Alertas, Saúde das fontes, Concorrentes, Base de conhecimento, Propostas, Narrativas, Código eleitoral
11. **Marketing** — Marketing hub, Impulsionamento (Ads), Peças de conteúdo com revisão de compliance
12. **Dicas e Boas Práticas** — Configuração inicial, Segurança, FAQ

## Como exportar como PDF

### No navegador (recomendado):

1. Abra o manual em `eleito.online/manual`
2. Pressione **Ctrl+P** (Windows/Linux) ou **⌘+P** (Mac)
3. Na janela de impressão, selecione:
   - Destino: **"Salvar como PDF"**
   - Orientação: **Retrato** (padrão)
   - Margens: **Mínimas**
4. Clique em **"Salvar"**

O PDF será salvo com o nome que você escolher e mantém toda a formatação e layout otimizado para impressão.

### Características de impressão:

- ✅ Sumário interativo com links
- ✅ Página de título com logo
- ✅ Numeração de seções
- ✅ Tabelas formatadas
- ✅ Dicas e alertas destacados
- ✅ Otimizado para cores e preto/branco
- ✅ Sem elementos de navegação na impressão

## Estructura do manual

Cada seção segue um padrão:

- **Resumo** — O que é e para que serve
- **Passos numerados** — Instruções passo-a-passo com refs aos botões/campos
- **Tabelas** — Quando relevante, dados organizados em tabelas
- **Dicas** — Atalhos e boas práticas (caixa amarela)
- **Alertas** — Informações importantes (caixa vermelha)

## Distribuição

O manual pode ser:

1. **Compartilhado via URL** — Envie o link `eleito.online/manual` para que qualquer pessoa acesse
2. **Exportado como PDF** — Baixe e distribua o arquivo PDF por e-mail ou pendrive
3. **Impresso** — Use a mesma função de exportação PDF para enviar à impressora

## Atualizações

O manual é mantido no repositório em:

```
apps/web/app/manual/page.tsx
```

Atualizações são feitas via commit de desenvolvimento e ficam disponíveis assim que o código é deployado.

## Suporte

Se encontrar dúvidas não cobertas no manual ou erros:

1. Consulte o **Tira-dúvidas jurídico** (para questões de legislação eleitoral)
2. Contacte o **Coordenador de Campanha** (questões administrativas)
3. Envie feedback para melhorias do manual via issue no repositório

# Licenciamento Ambiental

## Visão do projeto

Este é um projeto pessoal para melhorar e modernizar a forma como o
licenciamento ambiental é conduzido, começando pelo Estado de São Paulo e com
a ambição de poder atender outras regiões do Brasil. A aplicação busca
organizar informações e colaboração entre as pessoas e organizações envolvidas
em empreendimentos e seus processos de licenciamento.

O domínio central inclui projetos, pessoas físicas e jurídicas, membros e
partes relacionadas aos projetos. O MCE (Memorial de Caracterização do
Empreendimento) reúne informações do empreendimento, como fluxogramas,
equipamentos, operações, itens e fluxos.

## Stack

- JavaScript com Node.js.
- Next.js e React; a aplicação usa o roteador baseado em `pages/`.
- PostgreSQL, acessado pelo driver `pg`.
- `node-pg-migrate` para versionar e executar migrações do banco.
- Primer React para componentes de interface.
- Jest para testes; ESLint e Prettier para análise e formatação.
- Nodemailer para envio de e-mails.

## Organização da aplicação

- `pages/`: páginas da aplicação e endpoints HTTP em `pages/api/`. A API é
  organizada sob `/api/v1`.
- `interface/`: layouts, componentes reutilizáveis e elementos de interface
  específicos do domínio.
- `models/`: lógica e operações associadas às entidades e regras do domínio.
- `infra/`: integração com banco de dados, migrações, scripts e outros
  componentes de infraestrutura.

Preserve essa separação e siga os padrões existentes ao implementar mudanças.
Regras de negócio devem permanecer próximas aos modelos e não ser duplicadas
entre páginas e endpoints.

## Desenvolvimento

- Use as migrações existentes em `infra/migrations/` para alterações no
  esquema; não dependa de mudanças manuais no banco.
- Para rodar a aplicação localmente, use `npm run dev`. O comando inicia os
  serviços definidos no Compose, aguarda o banco e aplica as migrações antes
  de iniciar o Next.js.
- Para executar os testes, use `npm test`.
- Para verificar formatação e lint, use `npm run lint:prettier:check` e
  `npm run lint:eslint:check`.
- Não inclua credenciais ou valores de ambiente em código ou documentação.

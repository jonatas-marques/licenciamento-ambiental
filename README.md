# Licenciamento Ambiental

Projeto pessoal com a ambição de revolucionar a forma como o licenciamento
ambiental é feito no Estado de São Paulo — e, quem sabe, no Brasil.

A proposta é tornar a jornada de licenciamento mais organizada, clara e
eficiente, conectando projetos, organizações e as informações necessárias ao
processo. Hoje, a aplicação está sendo construída com foco na gestão de
projetos e organizações e no Memorial de Caracterização do Empreendimento
(MCE), incluindo seus fluxogramas e equipamentos.

Este é um projeto em evolução. A visão é contribuir para uma experiência melhor
para todos que participam do licenciamento ambiental.

## Configuração do remetente de email

Configure `EMAIL_FROM` com o endereço usado como remetente. No Vercel, defina
um valor diferente para cada ambiente:

- **Preview (homologação):** `LicenciamentoAmbiental <contato@prev.licenciamento-ambiental.dev.br>`
- **Production:** `LicenciamentoAmbiental <contato@licenciamento-ambiental.dev.br>`

O Vercel disponibiliza o valor correspondente ao ambiente da implantação. Para
desenvolvimento local, o endereço é configurado em `.env.development`.

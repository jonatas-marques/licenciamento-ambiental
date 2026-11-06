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

## Balanço hídrico

No editor do fluxograma, crie grupos de processo e associe etapas pelo painel
de propriedades. Os pontos azuis dos grupos e da fronteira permitem conectá-los
a etapas e outros grupos. Fontes e destinos externos podem receber um tipo
hídrico no painel; os grupos podem sugerir um uso e os fluxos podem informar
outro uso ou indicar reúso.

Associe ao fluxo um item da categoria água ou efluente e informe o volume anual
em `m³/ano`. O balanço usa a quantidade total do item de efluente como água:
não associe simultaneamente água e efluente ao mesmo fluxo para representar a
mesma quantidade. O formulário aceita `m³/ano` como período de referência,
sem adicionar ano ao catálogo de unidades SI. Vazões em outras unidades não
são convertidas automaticamente e são sinalizadas como pendentes.

A página Balanço hídrico mostra, por fluxograma, as entradas por fonte, as
entradas nos grupos por uso (incluindo reúso sinalizado) e as saídas por
destino. A média mensal é o total anual dividido por 12. Fluxos sem itens,
quantidades ausentes e algumas possíveis sobreposições geram avisos; eles não
representam uma verificação exaustiva do desenho. O saldo não distingue perdas,
incorporação, uso consumptivo ou variação de armazenamento. Reservatórios de
mistura não determinam a parcela de cada fonte em cada uso.

Para experimentar localmente, execute `npm run seed:dev` após aplicar as
migrações. No projeto **Mineradora Rio Claro — Lavra de areia (exemplo)**,
selecione o fluxograma **Balanço hídrico — fontes e grupos (exemplo)**. Duas
fontes alimentam um reservatório que distribui água para grupos de uso
industrial e sanitário; os efluentes seguem para destinos distintos. Os dados
são fictícios e podem ser editados.

## Configuração do remetente de email

Configure `EMAIL_FROM` com o endereço usado como remetente. No Vercel, defina
um valor diferente para cada ambiente:

- **Preview (homologação):** `LicenciamentoAmbiental <contato@prev.licenciamento-ambiental.dev.br>`
- **Production:** `LicenciamentoAmbiental <contato@licenciamento-ambiental.dev.br>`

O Vercel disponibiliza o valor correspondente ao ambiente da implantação. Para
desenvolvimento local, o endereço é configurado em `.env.development`.

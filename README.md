# clone-tabnews

Repositório para estudo no Curso.dev do @filipedeschamps.

## Configuração do remetente de email

Configure `EMAIL_FROM` com o endereço usado como remetente. No Vercel, defina
um valor diferente para cada ambiente:

- **Preview (homologação):** `LicenciamentoAmbiental <contato@prev.licenciamento-ambiental.dev.br>`
- **Production:** `LicenciamentoAmbiental <contato@licenciamento-ambiental.dev.br>`

O Vercel disponibiliza o valor correspondente ao ambiente da implantação. Para
desenvolvimento local, o endereço é configurado em `.env.development`.

## Projetos

Projects representam empreendimentos em licenciamento. O nome é único
globalmente. A criação do projeto e a associação de seu criador como `owner`
ocorrem na mesma transação; o acesso subsequente é controlado por
`project_members`, não apenas pelo conhecimento do UUID.

Projetos podem ter status `active` ou `archived`. O arquivamento preserva o
registro e seus vínculos; as rotas privadas estão disponíveis sob
`/api/v1/projects`.

### Versionamento inicial do MCE

Cada versão do MCE é uma linha independente em `mces`, identificada por
`project_id` e número de versão. O banco garante a unicidade dessa combinação e
permite no máximo um rascunho (`draft`) por projeto. Para iniciar outra versão,
o rascunho atual precisa ser arquivado; versões arquivadas permanecem no
histórico e os números não são reutilizados. Apenas `owner` e `admin` podem
criar ou arquivar versões; membros do projeto podem consultá-las.

Esta primeira etapa não inclui submissão nem seções técnicas. O modelo e as
rotas mantêm cada versão associada ao projeto para que as próximas seções do
MCE possam referenciar seu `mce_id`.

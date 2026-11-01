# clone-tabnews

Repositório para estudo no Curso.dev do @filipedeschamps.

## Configuração do remetente de email

Configure `EMAIL_FROM` com o endereço usado como remetente. No Vercel, defina
um valor diferente para cada ambiente:

- **Preview (homologação):** `LicenciamentoAmbiental <contato@prev.licenciamento-ambiental.dev.br>`
- **Production:** `LicenciamentoAmbiental <contato@licenciamento-ambiental.dev.br>`

O Vercel disponibiliza o valor correspondente ao ambiente da implantação. Para
desenvolvimento local, o endereço é configurado em `.env.development`.

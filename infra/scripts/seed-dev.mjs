import { register } from "node:module";
import dotenv from "dotenv";

dotenv.config({ path: ".env.development", quiet: true });

const localHosts = ["localhost", "127.0.0.1", "::1"];

if (
  process.env.NODE_ENV === "production" ||
  !localHosts.includes(process.env.POSTGRES_HOST)
) {
  console.error("Seed recusado: ele só roda contra o banco PostgreSQL local.");
  process.exit(1);
}

// Permite que os models resolvam imports como "infra/database.js" fora do Next.
register(
  "data:text/javascript," +
    encodeURIComponent(`
      import { pathToFileURL } from "node:url";
      import { resolve as resolvePath } from "node:path";
      export async function resolve(specifier, context, nextResolve) {
        if (/^(infra|models)\\//.test(specifier)) {
          const file = resolvePath(process.cwd(), specifier);
          const url = pathToFileURL(/\\.m?js$/.test(file) ? file : file + ".js").href;
          return nextResolve(url, context);
        }
        if (/^\\.{1,2}\\//.test(specifier) && !/\\.[cm]?js(on)?$/.test(specifier)) {
          try { return await nextResolve(specifier + ".js", context); } catch {}
        }
        return nextResolve(specifier, context);
      }
    `),
  import.meta.url,
);

const { default: user } = await import("models/user.js");
const { default: activation } = await import("models/activation.js");
const { default: person } = await import("models/person.js");
const { default: project } = await import("models/project.js");
const { default: party } = await import("models/party.js");
const { default: database } = await import("infra/database.js");

const password = "SenhaDev123";

const users = [
  {
    key: "owner",
    name: "Marina Albuquerque",
    cpf: "11144477735",
    email: "marina@exemplo.dev",
    role: "owner",
  },
  {
    key: "admin",
    name: "Carlos Eduardo Teixeira",
    cpf: "52998224725",
    email: "carlos@exemplo.dev",
    role: "admin",
  },
  {
    key: "viewer",
    name: "Beatriz Nogueira",
    cpf: "39053344705",
    email: "beatriz@exemplo.dev",
    role: "viewer",
  },
];

async function findOrCreateUser(seedUser) {
  let account;

  try {
    account = await user.findOneByEmail(seedUser.email);
  } catch {
    account = await user.create({
      cpf: seedUser.cpf,
      email: seedUser.email,
      password,
    });
    account = await activation.activateUserByUserId(account.id);
  }

  try {
    await person.findOneByCpf(seedUser.cpf);
  } catch {
    await person.createNaturalPerson({
      name: seedUser.name,
      cpf: seedUser.cpf,
      created_by: account.id,
      user_id: account.id,
    });
  }

  return account;
}

async function ensureNaturalPerson(values, createdBy) {
  try {
    return await person.findOneByCpf(values.cpf);
  } catch {
    return await person.createNaturalPerson({
      ...values,
      created_by: createdBy,
    });
  }
}

async function ensureLegalPerson(values, createdBy) {
  try {
    return await person.findOneByCnpj(values.cnpj);
  } catch {
    return await person.createLegalPerson({ ...values, created_by: createdBy });
  }
}

async function ensureProject(name, ownerId) {
  const existing = await database.query({
    text: "SELECT * FROM projects WHERE name = $1;",
    values: [name],
  });

  if (existing.rowCount > 0) {
    return existing.rows[0];
  }

  return await project.create({ name, created_by: ownerId });
}

async function ensureMember(requestingUser, projectId, account, role) {
  try {
    await project.addMember(requestingUser, {
      project_id: projectId,
      user_id: account.id,
      role,
    });
  } catch (error) {
    if (error.message !== "Usuário já é membro do projeto.") {
      throw error;
    }
  }
}

async function ensureParty(requestingUser, projectId, personCp, interest) {
  try {
    await party.addParty(requestingUser, projectId, {
      person_cp: personCp,
      interest,
    });
  } catch (error) {
    if (error.message !== "Pessoa já é parte interessada neste projeto.") {
      throw error;
    }
  }
}

try {
  const accounts = {};
  for (const seedUser of users) {
    accounts[seedUser.key] = await findOrCreateUser(seedUser);
  }
  const owner = accounts.owner;

  const consultant = await ensureNaturalPerson(
    { name: "Rafael Monteiro Lima", cpf: "86288366757" },
    owner.id,
  );
  const company = await ensureLegalPerson(
    { name: "Mineradora Rio Claro Ltda", cnpj: "11222333000181" },
    owner.id,
  );
  const consultancy = await ensureLegalPerson(
    { name: "EcoConsult Consultoria Ambiental", cnpj: "45723174000110" },
    owner.id,
  );

  const demoProject = await ensureProject(
    "Mineradora Rio Claro — Lavra de areia (exemplo)",
    owner.id,
  );
  await ensureProject("Fazenda Boa Esperança — Irrigação (exemplo)", owner.id);

  await ensureMember(owner, demoProject.id, accounts.admin, "admin");
  await ensureMember(owner, demoProject.id, accounts.viewer, "viewer");

  await ensureParty(owner, demoProject.id, company.cnpj, "empreendedor");
  await ensureParty(owner, demoProject.id, consultancy.cnpj, "consultoria");
  await ensureParty(
    owner,
    demoProject.id,
    consultant.cpf,
    "responsável técnico",
  );

  console.log("Dados de desenvolvimento prontos.");
  console.log(`Senha de todos os usuários de exemplo: ${password}`);
  for (const seedUser of users) {
    console.log(`- ${seedUser.role}: CPF ${seedUser.cpf} (${seedUser.email})`);
  }
} finally {
  // Cada consulta usa uma conexão própria; nada a encerrar.
}

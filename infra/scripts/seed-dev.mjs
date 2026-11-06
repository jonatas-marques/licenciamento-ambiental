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
const { default: mce } = await import("models/mce.js");
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
  {
    key: "member",
    name: "Rodrigo Fernandes",
    cpf: "12345678909",
    email: "rodrigo@exemplo.dev",
    role: "member",
  },
  {
    key: "owner2",
    name: "Juliana Prado",
    cpf: "98765432100",
    email: "juliana@exemplo.dev",
    role: "owner (outro tenant)",
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

async function ensureLegalMember(legalPerson, naturalPerson, role) {
  try {
    await person.addLegalPersonMember({
      legal_person_id: legalPerson.id,
      natural_person_id: naturalPerson.id,
      role,
    });
  } catch (error) {
    if (!/já/i.test(error.message)) {
      throw error;
    }
  }
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

async function ensureParty(requestingUser, projectId, personId, interest) {
  try {
    await party.addParty(requestingUser, projectId, {
      person_id: personId,
      interest,
    });
  } catch (error) {
    if (error.message !== "Pessoa já é parte interessada neste projeto.") {
      throw error;
    }
  }
}

async function ensureMce(requestingUser, projectId, status) {
  try {
    await mce.getMce(requestingUser, projectId);
  } catch {
    await mce.createMce(requestingUser, projectId);
  }

  if (status) {
    await mce.updateMce(requestingUser, projectId, { status });
  }
}

async function ensureItems(resourceName, requestingUser, projectId, items) {
  const existing = await mce.listItems(resourceName, requestingUser, projectId);
  const names = new Set(existing.map((item) => item.name));

  for (const item of items) {
    const name = item.name ?? item.custom_name;
    if (names.has(name)) {
      continue;
    }
    await mce.createItem(resourceName, requestingUser, projectId, item);
  }
}

// Monta o diagrama de um fluxograma (etapas, itens e fluxos) uma única vez.
// Posições na grade de 20px; o retângulo do empreendimento padrão vai de
// x=100 a x=500 e de y=200 a y=840. O fluxo corre de cima para baixo.
async function ensureDiagram(user, projectId, flowchartName, diagram) {
  const flowcharts = await mce.listItems("flowcharts", user, projectId);
  const flowchart = flowcharts.find((item) => item.name === flowchartName);
  const operations = await mce.listItems("operations", user, projectId);
  if (operations.some((item) => item.flowchart_id === flowchart.id)) {
    return;
  }

  await ensureItems("items", user, projectId, diagram.items);
  const items = await mce.listItems("items", user, projectId);
  const itemId = (name) => items.find((item) => item.name === name).id;

  const operationIds = {};
  for (const operation of diagram.operations) {
    const { key, x, y, ...values } = operation;
    const created = await mce.createItem("operations", user, projectId, {
      flowchart_id: flowchart.id,
      boundary:
        values.category in { fonte: 1, sumidouro: 1 } ? "external" : "internal",
      shape_x: x,
      shape_y: y,
      ...values,
    });
    operationIds[key] = created.id;
  }

  for (const flow of diagram.flows) {
    const created = await mce.createItem("flows", user, projectId, {
      flowchart_id: flowchart.id,
      source_operation_id: operationIds[flow.from],
      target_operation_id: operationIds[flow.to],
      label: flow.label,
    });
    for (const [name, quantity, unit] of flow.items ?? []) {
      await mce.createItem("flow_items", user, projectId, {
        flow_id: created.id,
        item_id: itemId(name),
        quantity,
        unit,
      });
    }
  }
}

// Acrescenta apenas registros ausentes, sem substituir edições feitas no exemplo.
async function ensureWaterBalanceDiagram(user, projectId) {
  const name = "Balanço hídrico — fontes e grupos (exemplo)";
  await ensureItems("flowcharts", user, projectId, [
    {
      name,
      description:
        "Duas fontes alimentam um reservatório antes da distribuição aos grupos de uso.",
      boundary_x: 100,
      boundary_y: 200,
      boundary_width: 900,
      boundary_height: 720,
    },
  ]);
  const charts = await mce.listItems("flowcharts", user, projectId);
  const chart = charts.find((entry) => entry.name === name);
  const existingGroups = (
    await mce.listItems("operation_groups", user, projectId)
  ).filter((entry) => entry.flowchart_id === chart.id);
  const groupIds = {};
  for (const group of [
    {
      key: "production",
      name: "Unidade produtiva",
      water_use: "industrial",
      shape_x: 150,
      shape_y: 450,
      width: 300,
      height: 220,
    },
    {
      key: "support",
      name: "Áreas de apoio",
      water_use: "sanitario",
      shape_x: 600,
      shape_y: 450,
      width: 300,
      height: 220,
    },
  ]) {
    const { key, ...values } = group;
    const existing = existingGroups.find((entry) => entry.name === values.name);
    const saved =
      existing ??
      (await mce.createItem("operation_groups", user, projectId, {
        flowchart_id: chart.id,
        ...values,
      }));
    groupIds[key] = saved.id;
  }

  const existingOperations = (
    await mce.listItems("operations", user, projectId)
  ).filter((entry) => entry.flowchart_id === chart.id);
  const operationIds = {};
  for (const operation of [
    {
      key: "well",
      name: "Poço subterrâneo",
      category: "fonte",
      boundary: "external",
      water_type: "subterranea",
      shape_x: 200,
      shape_y: 80,
    },
    {
      key: "network",
      name: "Rede pública de água",
      category: "fonte",
      boundary: "external",
      water_type: "rede_publica",
      shape_x: 650,
      shape_y: 80,
    },
    {
      key: "reservoir",
      name: "Reservatório",
      category: "estoque",
      boundary: "internal",
      shape_x: 450,
      shape_y: 270,
    },
    {
      key: "production",
      name: "Lavagem industrial",
      category: "transformacao",
      boundary: "internal",
      group: "production",
      shape_x: 220,
      shape_y: 540,
    },
    {
      key: "support",
      name: "Instalações sanitárias",
      category: "apoio",
      boundary: "internal",
      group: "support",
      shape_x: 670,
      shape_y: 540,
    },
    {
      key: "river",
      name: "Corpo hídrico receptor",
      category: "sumidouro",
      boundary: "external",
      water_type: "corpo_hidrico",
      shape_x: 220,
      shape_y: 1000,
    },
    {
      key: "sewer",
      name: "Rede coletora de esgoto",
      category: "sumidouro",
      boundary: "external",
      water_type: "rede_coletora",
      shape_x: 670,
      shape_y: 1000,
    },
  ]) {
    const { key, group, ...values } = operation;
    const existing = existingOperations.find(
      (entry) => entry.name === values.name,
    );
    const saved =
      existing ??
      (await mce.createItem("operations", user, projectId, {
        flowchart_id: chart.id,
        ...values,
        ...(group && { group_id: groupIds[group] }),
      }));
    operationIds[key] = saved.id;
  }

  await ensureItems("items", user, projectId, [
    { name: "Água — balanço hídrico (exemplo)", category: "agua" },
    { name: "Efluente — balanço hídrico (exemplo)", category: "efluente" },
  ]);
  const items = await mce.listItems("items", user, projectId);
  const water = items.find(
    (item) => item.name === "Água — balanço hídrico (exemplo)",
  );
  const effluent = items.find(
    (item) => item.name === "Efluente — balanço hídrico (exemplo)",
  );
  const existingFlows = (await mce.listItems("flows", user, projectId)).filter(
    (entry) => entry.flowchart_id === chart.id,
  );
  const existingFlowItems = await mce.listItems("flow_items", user, projectId);

  for (const flow of [
    {
      label: "Captação subterrânea",
      source_operation_id: operationIds.well,
      target_operation_id: operationIds.reservoir,
      item: water,
      quantity: 8000,
    },
    {
      label: "Abastecimento público",
      source_operation_id: operationIds.network,
      target_operation_id: operationIds.reservoir,
      item: water,
      quantity: 4000,
    },
    {
      label: "Uso industrial",
      source_operation_id: operationIds.reservoir,
      target_group_id: groupIds.production,
      item: water,
      quantity: 9000,
    },
    {
      label: "Uso sanitário",
      source_operation_id: operationIds.reservoir,
      target_group_id: groupIds.support,
      item: water,
      quantity: 3000,
    },
    {
      label: "Efluente industrial",
      source_group_id: groupIds.production,
      target_operation_id: operationIds.river,
      item: effluent,
      quantity: 6500,
    },
    {
      label: "Efluente sanitário",
      source_group_id: groupIds.support,
      target_operation_id: operationIds.sewer,
      item: effluent,
      quantity: 2500,
    },
  ]) {
    const { item, quantity, ...values } = flow;
    const saved =
      existingFlows.find((entry) => entry.label === values.label) ??
      (await mce.createItem("flows", user, projectId, {
        flowchart_id: chart.id,
        ...values,
      }));
    if (
      !existingFlowItems.some(
        (entry) => entry.flow_id === saved.id && entry.item_id === item.id,
      )
    ) {
      await mce.createItem("flow_items", user, projectId, {
        flow_id: saved.id,
        item_id: item.id,
        quantity,
        unit: "m³/ano",
      });
    }
  }
}

// Resolve nome/modelo do catálogo (criado nas migrations) para IDs.
async function catalogEquipment(name, extra = {}, brandModel) {
  if (brandModel) {
    const results = await database.query({
      text: `
        SELECT equipment_catalog.*
        FROM equipment_catalog
        WHERE brand = $1 AND model = $2;
      `,
      values: brandModel,
    });
    const found = results.rows[0];
    if (found) {
      return {
        model_id: found.id,
        brand: found.brand,
        model: found.model,
        power: found.power,
        capacity: found.capacity,
        mobility: found.mobility,
        ...extra,
        name,
      };
    }
  }

  const results = await database.query({
    text: "SELECT id FROM equipments_names WHERE name = $1;",
    values: [name],
  });

  return results.rows[0]
    ? { name_id: results.rows[0].id, ...extra, name }
    : { custom_name: name, ...extra, name };
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

  const owner2 = accounts.owner2;

  const technician = await ensureNaturalPerson(
    { name: "Camila Ribeiro Santos", cpf: "24681357928" },
    owner.id,
  );
  const farm = await ensureLegalPerson(
    { name: "Fazenda Boa Esperança Agropecuária S/A", cnpj: "98765432000198" },
    owner.id,
  );
  const coldStorage = await ensureLegalPerson(
    { name: "Frigorífico Serra Azul Ltda", cnpj: "55566677000183" },
    owner2.id,
  );
  const metalworks = await ensureLegalPerson(
    { name: "Metalúrgica Usinar Indústria Ltda", cnpj: "33344455000183" },
    accounts.admin.id,
  );

  await ensureLegalMember(company, consultant, "responsável técnico");
  await ensureLegalMember(consultancy, consultant, "sócio");
  await ensureLegalMember(consultancy, technician, "analista ambiental");
  await ensureLegalMember(farm, technician, "responsável técnico");

  const demoProject = await ensureProject(
    "Mineradora Rio Claro — Lavra de areia (exemplo)",
    owner.id,
  );
  const farmProject = await ensureProject(
    "Fazenda Boa Esperança — Irrigação (exemplo)",
    owner.id,
  );
  const coldProject = await ensureProject(
    "Frigorífico Serra Azul — Câmaras frias (exemplo)",
    owner2.id,
  );
  const metalProject = await ensureProject(
    "Metalúrgica Usinar — Usinagem e fundição (exemplo)",
    accounts.admin.id,
  );
  await ensureProject("Projeto vazio — sem MCE nem partes (exemplo)", owner.id);

  await ensureMember(owner, demoProject.id, accounts.admin, "admin");
  await ensureMember(owner, demoProject.id, accounts.member, "member");
  await ensureMember(owner, demoProject.id, accounts.viewer, "viewer");

  await ensureMember(owner, farmProject.id, accounts.member, "member");
  await ensureMember(owner, farmProject.id, accounts.viewer, "viewer");

  await ensureMember(owner2, coldProject.id, owner, "admin");
  await ensureMember(owner2, coldProject.id, accounts.member, "viewer");

  await ensureMember(accounts.admin, metalProject.id, accounts.member, "admin");
  await ensureMember(accounts.admin, metalProject.id, owner2, "member");

  await ensureParty(owner, demoProject.id, company.id, "responsável legal");
  await ensureParty(
    owner,
    demoProject.id,
    consultancy.id,
    "consultoria ambiental",
  );
  await ensureParty(
    owner,
    demoProject.id,
    consultant.id,
    "responsável técnico",
  );

  await ensureParty(owner, farmProject.id, farm.id, "responsável legal");
  await ensureParty(
    owner,
    farmProject.id,
    technician.id,
    "responsável técnico",
  );

  await ensureParty(
    owner2,
    coldProject.id,
    coldStorage.id,
    "responsável legal",
  );
  await ensureParty(
    owner2,
    coldProject.id,
    consultancy.id,
    "consultoria ambiental",
  );

  await ensureParty(
    accounts.admin,
    metalProject.id,
    metalworks.id,
    "responsável legal",
  );

  // MCE concluído, com fluxogramas e equipamentos do catálogo e personalizados.
  await ensureMce(owner, demoProject.id);
  await ensureItems("flowcharts", owner, demoProject.id, [
    {
      name: "Extração e beneficiamento de areia",
      description:
        "Dragagem, bombeamento da polpa, peneiramento, lavagem e estocagem.",
    },
    {
      name: "Manutenção de máquinas",
      description: "Lubrificação, troca de óleo e lavagem de peças.",
    },
  ]);
  await ensureItems("equipments", accounts.member, demoProject.id, [
    await catalogEquipment(
      "Gerador a diesel",
      { location: "Casa de força", status: "operando" },
      ["Geradex", "GD-100"],
    ),
    await catalogEquipment(
      "Compressor de ar",
      { location: "Oficina", status: "operando" },
      ["Tramontex", "3GR"],
    ),
    await catalogEquipment("Empilhadeira", {
      location: "Pátio de estocagem",
      status: "em manutenção",
      mobility: "móvel",
    }),
    await catalogEquipment("Draga de sucção", {
      description: "Draga flutuante para extração de areia.",
      power: 150,
      capacity: 120,
      mobility: "móvel",
      location: "Leito do rio",
      status: "operando",
    }),
  ]);
  await ensureDiagram(
    owner,
    demoProject.id,
    "Extração e beneficiamento de areia",
    {
      items: [
        { name: "Água do rio", category: "agua" },
        { name: "Óleo diesel", category: "insumo" },
        { name: "Areia lavada", category: "produto" },
        {
          name: "Efluente de lavagem",
          category: "efluente",
          details: {
            type: "industrial",
            treated: true,
            final_destination: "Decantador",
          },
        },
        {
          name: "Rejeito de peneiramento",
          category: "residuo",
          details: {
            abnt_class: "IIB",
            final_destination: "Aterro de inertes",
          },
        },
        {
          name: "Gases de combustão",
          category: "emissao",
          details: { emission_factor: 2.68, unit: "kg/L" },
        },
      ],
      operations: [
        { key: "rio", name: "Rio", category: "fonte", x: 220, y: 80 },
        {
          key: "dragagem",
          name: "Dragagem",
          category: "transformacao",
          x: 220,
          y: 260,
        },
        {
          key: "peneira",
          name: "Peneiramento",
          category: "transformacao",
          x: 220,
          y: 420,
        },
        {
          key: "lavagem",
          name: "Lavagem",
          category: "transformacao",
          x: 220,
          y: 580,
        },
        {
          key: "patio",
          name: "Pátio de estocagem",
          category: "estoque",
          x: 220,
          y: 740,
        },
        {
          key: "clientes",
          name: "Clientes",
          category: "sumidouro",
          x: 540,
          y: 740,
        },
        {
          key: "aterro",
          name: "Aterro de inertes",
          category: "sumidouro",
          x: 540,
          y: 420,
        },
        {
          key: "corpo",
          name: "Corpo hídrico receptor",
          category: "sumidouro",
          x: 540,
          y: 580,
        },
      ],
      flows: [
        {
          from: "rio",
          to: "dragagem",
          label: "Captação",
          items: [["Água do rio", 120, "m³/h"]],
        },
        { from: "dragagem", to: "peneira", label: "Polpa" },
        { from: "peneira", to: "lavagem", label: "Areia" },
        {
          from: "peneira",
          to: "aterro",
          label: "Rejeito",
          items: [["Rejeito de peneiramento", 4, "t/d"]],
        },
        {
          from: "lavagem",
          to: "patio",
          label: "Areia lavada",
          items: [["Areia lavada", 80, "m³/d"]],
        },
        {
          from: "patio",
          to: "clientes",
          label: "Expedição",
          items: [["Areia lavada", 80, "m³/d"]],
        },
        {
          from: "lavagem",
          to: "corpo",
          label: "Efluente",
          items: [["Efluente de lavagem", 90, "m³/h"]],
        },
      ],
    },
  );
  await ensureWaterBalanceDiagram(owner, demoProject.id);
  await ensureMce(owner, demoProject.id, "completed");

  // MCE em rascunho.
  await ensureMce(owner, farmProject.id);
  await ensureItems("flowcharts", owner, farmProject.id, [
    {
      name: "Irrigação por pivô central",
      description: "Captação em açude, bombeamento e distribuição por pivô.",
    },
  ]);
  await ensureItems("equipments", owner, farmProject.id, [
    await catalogEquipment("Painel solar fotovoltaico", {
      location: "Casa de bombas",
      status: "operando",
    }),
    await catalogEquipment("Bomba centrífuga", {
      power: 55,
      capacity: 300,
      mobility: "fixo",
      location: "Margem do açude",
      status: "operando",
    }),
  ]);

  // MCE recém-criado, sem itens.
  await ensureMce(owner2, coldProject.id);
  await ensureItems("equipments", owner2, coldProject.id, [
    await catalogEquipment(
      "Chiller",
      { location: "Casa de máquinas", status: "operando" },
      ["Frioplus", "CH-60"],
    ),
    await catalogEquipment("Câmara fria", {
      location: "Setor de resfriamento",
      status: "operando",
    }),
  ]);

  await ensureMce(accounts.admin, metalProject.id);
  await ensureItems("flowcharts", accounts.admin, metalProject.id, [
    {
      name: "Usinagem de peças",
      description: "Recebimento de barras, corte, torneamento e expedição.",
    },
  ]);
  await ensureItems("equipments", accounts.admin, metalProject.id, [
    await catalogEquipment(
      "Torno",
      { location: "Galpão 1", status: "operando" },
      ["Usinar", "T-1000"],
    ),
    await catalogEquipment("Serra", { location: "Galpão 1" }),
    await catalogEquipment(
      "Caldeira",
      { location: "Utilidades", status: "parado" },
      ["Termosul", "CV-500"],
    ),
    await catalogEquipment("Ponte rolante", {
      capacity: 5000,
      mobility: "fixo",
      location: "Galpão 2",
    }),
  ]);

  console.log("Dados de desenvolvimento prontos.");
  console.log(
    "Balanço hídrico: no projeto Mineradora Rio Claro, selecione o fluxograma Balanço hídrico — fontes e grupos (exemplo).",
  );
  console.log(`Senha de todos os usuários de exemplo: ${password}`);
  for (const seedUser of users) {
    console.log(`- ${seedUser.role}: CPF ${seedUser.cpf} (${seedUser.email})`);
  }
} finally {
  // Cada consulta usa uma conexão própria; nada a encerrar.
}

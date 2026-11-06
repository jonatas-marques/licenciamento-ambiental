import database from "infra/database.js";
import project from "models/project.js";
import units from "models/units.js";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "infra/errors.js";

const MCE_STATUSES = ["draft", "completed"];
const EDITOR_ROLES = ["owner", "admin", "member"];

const text = (label, maxLength) => ({
  label,
  parse(value) {
    if (typeof value !== "string") {
      return invalid(label, "um texto");
    }
    const trimmed = value.trim();
    if (maxLength && trimmed.length > maxLength) {
      return invalid(label, `um texto de até ${maxLength} caracteres`);
    }
    return trimmed === "" ? null : trimmed;
  },
});

// Texto que deve ser uma unidade do SI (validada contra a tabela `units`).
const unit = (label) => ({ ...text(label, 64), isUnit: true });

const number = (label) => ({
  label,
  parse(value) {
    if (typeof value === "string" && value.trim() === "") {
      return null;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return invalid(label, "um número maior ou igual a zero");
    }
    return parsed;
  },
});

const oneOf = (label, allowed, { allowEmpty = false } = {}) => ({
  label,
  parse(value) {
    if (allowEmpty && value === "") {
      return null;
    }
    if (!allowed.includes(value)) {
      return invalid(label, `um destes valores: ${allowed.join(", ")}`);
    }
    return value;
  },
});

const boolean = (label) => ({
  label,
  parse(value) {
    if (value === "") {
      return null;
    }
    if (typeof value !== "boolean") {
      return invalid(label, "verdadeiro ou falso");
    }
    return value;
  },
});

const ratio = (label) => ({
  label,
  parse(value) {
    if (typeof value === "string" && value.trim() === "") {
      return null;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      return invalid(label, "um número entre 0 e 1");
    }
    return parsed;
  },
});

const uuid = (label) => ({
  label,
  parse(value) {
    if (typeof value === "string" && value.trim() === "") {
      return null;
    }
    if (!isUuid(value)) {
      return invalid(label, "um ID válido");
    }
    return value;
  },
});

function invalid(field, expected) {
  throw new ValidationError({
    name: "ValidationError",
    message: `Valor inválido para '${field}'.`,
    action: `Envie ${expected} em '${field}'.`,
    status_code: 400,
  });
}

const OPERATION_CATEGORIES = [
  "transformacao",
  "apoio",
  "estoque",
  "fonte",
  "sumidouro",
];
const WATER_USES = ["sanitario", "industrial", "outro"];
const WATER_SOURCE_TYPES = [
  "rede_publica",
  "subterranea",
  "superficial",
  "outra_fonte",
];
const WATER_DESTINATION_TYPES = [
  "rede_coletora",
  "corpo_hidrico",
  "tratamento_externo",
  "outro_destino",
];

// A categoria do item define a tabela com os detalhes específicos.
const ITEM_SUBTYPES = {
  residuo: {
    table: "item_wastes",
    fields: {
      hazard_class: text("hazard_class"),
      abnt_class: text("abnt_class"),
      ibama_code: text("ibama_code"),
      final_destination: text("final_destination"),
      notes: text("notes"),
    },
  },
  efluente: {
    table: "item_effluents",
    fields: {
      type: text("type"),
      treated: boolean("treated"),
      final_destination: text("final_destination"),
    },
  },
  energia: {
    table: "item_energy",
    fields: { type: text("type"), unit: unit("unit") },
  },
  emissao: {
    table: "item_emissions",
    fields: { emission_factor: number("emission_factor"), unit: unit("unit") },
  },
};

const RESOURCES = {
  flowcharts: {
    table: "flowcharts",
    label: "Fluxograma",
    required: ["name"],
    selectSql: "SELECT flowcharts.* FROM flowcharts",
    fields: {
      name: text("name", 254),
      description: text("description"),
      boundary_x: number("boundary_x"),
      boundary_y: number("boundary_y"),
      boundary_width: number("boundary_width"),
      boundary_height: number("boundary_height"),
    },
    orderBy: "name ASC, created_at ASC",
  },
  operation_groups: {
    table: "operation_groups",
    label: "Grupo",
    required: ["flowchart_id", "name"],
    selectSql: "SELECT operation_groups.* FROM operation_groups",
    scope: (mceId) =>
      `operation_groups.flowchart_id IN (SELECT id FROM flowcharts WHERE mce_id = ${mceId})`,
    references: [{ field: "flowchart_id", resource: "flowcharts" }],
    immutable: ["flowchart_id"],
    fields: {
      flowchart_id: uuid("flowchart_id"),
      name: text("name", 254),
      water_use: oneOf("water_use", WATER_USES, { allowEmpty: true }),
      shape_x: number("shape_x"),
      shape_y: number("shape_y"),
      width: number("width"),
      height: number("height"),
    },
    orderBy: "name ASC, created_at ASC",
  },
  operations: {
    table: "operations",
    label: "Etapa",
    required: ["flowchart_id", "name"],
    selectSql: "SELECT operations.* FROM operations",
    scope: (mceId) =>
      `operations.flowchart_id IN (SELECT id FROM flowcharts WHERE mce_id = ${mceId})`,
    references: [
      { field: "flowchart_id", resource: "flowcharts" },
      { field: "group_id", resource: "operation_groups", sameFlowchart: true },
    ],
    immutable: ["flowchart_id"],
    fields: {
      flowchart_id: uuid("flowchart_id"),
      boundary: oneOf("boundary", ["internal", "external"]),
      name: text("name", 254),
      type: text("type"),
      category: oneOf("category", OPERATION_CATEGORIES, { allowEmpty: true }),
      group_id: uuid("group_id"),
      water_type: oneOf(
        "water_type",
        [...WATER_SOURCE_TYPES, ...WATER_DESTINATION_TYPES],
        { allowEmpty: true },
      ),
      description: text("description"),
      shape_x: number("shape_x"),
      shape_y: number("shape_y"),
    },
    orderBy: "created_at ASC",
  },
  items: {
    table: "items",
    label: "Item",
    required: ["name"],
    selectSql: `
      SELECT
        items.*,
        COALESCE(
          to_jsonb(item_wastes),
          to_jsonb(item_effluents),
          to_jsonb(item_energy),
          to_jsonb(item_emissions)
        ) - 'id' AS details
      FROM items
      LEFT JOIN item_wastes ON item_wastes.id = items.id
      LEFT JOIN item_effluents ON item_effluents.id = items.id
      LEFT JOIN item_energy ON item_energy.id = items.id
      LEFT JOIN item_emissions ON item_emissions.id = items.id
    `,
    subtypes: ITEM_SUBTYPES,
    fields: {
      name: text("name", 254),
      category: oneOf(
        "category",
        Object.keys(ITEM_SUBTYPES).concat(["insumo", "produto", "agua"]),
        {
          allowEmpty: true,
        },
      ),
      description: text("description"),
    },
    orderBy: "name ASC, created_at ASC",
  },
  flows: {
    table: "flows",
    label: "Fluxo",
    required: ["flowchart_id"],
    selectSql: "SELECT flows.* FROM flows",
    scope: (mceId) =>
      `flows.flowchart_id IN (SELECT id FROM flowcharts WHERE mce_id = ${mceId})`,
    references: [
      { field: "flowchart_id", resource: "flowcharts" },
      {
        field: "source_operation_id",
        resource: "operations",
        sameFlowchart: true,
      },
      {
        field: "target_operation_id",
        resource: "operations",
        sameFlowchart: true,
      },
      {
        field: "source_group_id",
        resource: "operation_groups",
        sameFlowchart: true,
      },
      {
        field: "target_group_id",
        resource: "operation_groups",
        sameFlowchart: true,
      },
    ],
    immutable: ["flowchart_id"],
    fields: {
      flowchart_id: uuid("flowchart_id"),
      source_operation_id: uuid("source_operation_id"),
      target_operation_id: uuid("target_operation_id"),
      source_group_id: uuid("source_group_id"),
      target_group_id: uuid("target_group_id"),
      source_boundary: boolean("source_boundary"),
      target_boundary: boolean("target_boundary"),
      water_use: oneOf("water_use", WATER_USES, { allowEmpty: true }),
      water_reuse: boolean("water_reuse"),
      label: text("label"),
      type: text("type"),
      description: text("description"),
      bend_ratio: ratio("bend_ratio"),
    },
    orderBy: "created_at ASC",
  },
  flow_items: {
    table: "flow_items",
    label: "Item do fluxo",
    required: ["flow_id", "item_id"],
    selectSql: "SELECT flow_items.* FROM flow_items",
    scope: (mceId) =>
      `flow_items.flow_id IN (
        SELECT flows.id FROM flows
        JOIN flowcharts ON flowcharts.id = flows.flowchart_id
        WHERE flowcharts.mce_id = ${mceId}
      )`,
    references: [
      { field: "flow_id", resource: "flows" },
      { field: "item_id", resource: "items" },
    ],
    immutable: ["flow_id", "item_id"],
    fields: {
      flow_id: uuid("flow_id"),
      item_id: uuid("item_id"),
      quantity: number("quantity"),
      unit: unit("unit"),
    },
    orderBy: "created_at ASC",
  },
  equipments: {
    table: "equipments",
    label: "Equipamento",
    required: [],
    requireOneOf: ["name_id", "model_id", "custom_name"],
    selectSql: `
      SELECT
        equipments.*,
        COALESCE(equipments_names.name, equipments.custom_name) AS name,
        equipments_categories.category AS category
      FROM equipments
      LEFT JOIN equipments_names ON equipments_names.id = equipments.name_id
      LEFT JOIN equipments_categories
        ON equipments_categories.id = equipments_names.category_id
    `,
    fields: {
      name_id: uuid("name_id"),
      custom_name: text("custom_name", 254),
      model_id: uuid("model_id"),
      brand: text("brand", 254),
      model: text("model", 254),
      description: text("description"),
      power: number("power"),
      capacity: number("capacity"),
      mobility: text("mobility", 32),
      location: text("location"),
      status: text("status", 32),
    },
    orderBy: "name ASC, created_at ASC",
  },
};

function scopeCondition(resource, param) {
  return resource.scope
    ? resource.scope(param)
    : `${resource.table}.mce_id = ${param}`;
}

function getResource(resourceName) {
  if (!Object.hasOwn(RESOURCES, resourceName)) {
    throw new NotFoundError({
      message: "Recurso do MCE não encontrado.",
      action: `Use um destes recursos: ${Object.keys(RESOURCES).join(", ")}.`,
      status_code: 404,
    });
  }
  return RESOURCES[resourceName];
}

function parseValues(resource, input, { partial }) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError({
      name: "ValidationError",
      message: "Corpo da requisição inválido.",
      action: "Envie um objeto JSON com os campos desejados.",
      status_code: 400,
    });
  }

  const parsed = {};
  for (const [field, definition] of Object.entries(resource.fields)) {
    if (input[field] === undefined) {
      continue;
    }
    parsed[field] =
      input[field] === null ? null : definition.parse(input[field]);
  }

  for (const field of resource.required) {
    const missing = partial
      ? field in parsed && parsed[field] === null
      : !parsed[field];
    if (missing) {
      throw new ValidationError({
        name: "ValidationError",
        message: `O campo '${field}' é obrigatório.`,
        action: `Envie um valor não vazio em '${field}'.`,
        status_code: 400,
      });
    }
  }

  if (partial && Object.keys(parsed).length === 0) {
    throw new ValidationError({
      name: "ValidationError",
      message: "Nenhum campo para atualizar.",
      action: `Envie ao menos um destes campos: ${Object.keys(resource.fields).join(", ")}.`,
      status_code: 400,
    });
  }

  return parsed;
}

// `merged` é o estado final do item (no PATCH, valores atuais + enviados).
async function validateUnits(fields, values) {
  for (const [field, definition] of Object.entries(fields)) {
    if (definition.isUnit) {
      await units.assertValid(field, values[field]);
    }
  }
}

async function validateOneOf(resource, values, merged = values) {
  if (!resource.requireOneOf) {
    return;
  }

  if (!resource.requireOneOf.some((field) => merged[field])) {
    throw new ValidationError({
      name: "ValidationError",
      message: "Nome do item não informado.",
      action: `Informe um destes campos: ${resource.requireOneOf.join(", ")}.`,
      status_code: 400,
    });
  }

  if (values.model_id) {
    const results = await database.query({
      text: `SELECT name_id FROM equipment_catalog WHERE id = $1 AND active;`,
      values: [values.model_id],
    });

    if (results.rowCount === 0) {
      throw new ValidationError({
        name: "ValidationError",
        message: "Modelo de equipamento inexistente ou inativo.",
        action: "Escolha um modelo da lista ou informe os dados manualmente.",
        status_code: 400,
      });
    }

    values.name_id = results.rows[0].name_id;
    merged.name_id = values.name_id;
  }

  if (values.name_id) {
    const results = await database.query({
      text: `SELECT 1 FROM equipments_names WHERE id = $1 AND active;`,
      values: [values.name_id],
    });

    if (results.rowCount === 0) {
      throw new ValidationError({
        name: "ValidationError",
        message: "Nome de equipamento inexistente ou inativo.",
        action: "Escolha um nome da lista ou informe 'custom_name'.",
        status_code: 400,
      });
    }
  }
}

// Garante que os registros referenciados pertencem ao mesmo MCE.
async function validateReferences(resource, mceId, merged, values) {
  for (const reference of resource.references ?? []) {
    const id = merged[reference.field];
    if (!id || values[reference.field] === undefined) {
      continue;
    }

    const target = getResource(reference.resource);
    const conditions = [
      `${target.table}.id = $1`,
      scopeCondition(target, "$2"),
    ];
    const params = [id, mceId];
    if (reference.sameFlowchart) {
      conditions.push(`${target.table}.flowchart_id = $3`);
      params.push(merged.flowchart_id);
    }

    const results = await database.query({
      text: `SELECT 1 FROM ${target.table} WHERE ${conditions.join(" AND ")};`,
      values: params,
    });

    if (results.rowCount === 0) {
      throw new ValidationError({
        name: "ValidationError",
        message: `Valor inválido para '${reference.field}'.`,
        action: `Informe um '${reference.field}' existente neste MCE${reference.sameFlowchart ? " e no mesmo fluxograma" : ""}.`,
        status_code: 400,
      });
    }
  }
}

function splitDetails(resource, input) {
  if (
    !resource.subtypes ||
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    input.details === undefined
  ) {
    return { fields: input, details: undefined };
  }
  const { details, ...fields } = input;
  return { fields, details };
}

// Mantém apenas a tabela de detalhes correspondente à categoria do item.
async function saveDetails(resource, itemId, category, details) {
  if (!resource.subtypes) {
    return;
  }

  for (const [name, subtype] of Object.entries(resource.subtypes)) {
    if (name !== category) {
      await database.query({
        text: `DELETE FROM ${subtype.table} WHERE id = $1;`,
        values: [itemId],
      });
    }
  }

  const subtype = resource.subtypes[category];
  if (!subtype || details === undefined) {
    return;
  }

  if (
    details === null ||
    typeof details !== "object" ||
    Array.isArray(details)
  ) {
    invalid("details", "um objeto");
  }

  const parsed = {};
  for (const [field, definition] of Object.entries(subtype.fields)) {
    if (details[field] !== undefined) {
      parsed[field] =
        details[field] === null ? null : definition.parse(details[field]);
    }
  }

  await validateUnits(subtype.fields, parsed);

  const columns = ["id", ...Object.keys(parsed)];
  const updates = Object.keys(parsed).map(
    (column) => `${column} = EXCLUDED.${column}`,
  );
  await database.query({
    text: `
      INSERT INTO ${subtype.table} (${columns.join(", ")})
      VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})
      ON CONFLICT (id) DO ${updates.length > 0 ? `UPDATE SET ${updates.join(", ")}` : "NOTHING"};
    `,
    values: [itemId, ...Object.values(parsed)],
  });
}

function rejectImmutableChanges(resource, existing, values) {
  for (const field of resource.immutable ?? []) {
    if (values[field] !== undefined && values[field] !== existing[field]) {
      throw new ValidationError({
        name: "ValidationError",
        message: `O campo '${field}' não pode ser alterado.`,
        action: `Remova '${field}' ou crie um novo registro.`,
        status_code: 400,
      });
    }
  }
}

function validateFlowchartResource(resourceName, values) {
  if (resourceName === "operation_groups") {
    for (const field of ["shape_x", "shape_y"]) {
      if (values[field] === null)
        invalid(field, "um número maior ou igual a zero");
    }
    if (
      values.width !== undefined &&
      (values.width === null || values.width < 100)
    ) {
      invalid("width", "um número maior ou igual a 100");
    }
    if (
      values.height !== undefined &&
      (values.height === null || values.height < 80)
    ) {
      invalid("height", "um número maior ou igual a 80");
    }
  }
  if (resourceName === "operations" && values.water_type) {
    const allowed =
      values.category === "fonte"
        ? WATER_SOURCE_TYPES
        : values.category === "sumidouro"
          ? WATER_DESTINATION_TYPES
          : [];
    if (!allowed.includes(values.water_type)) {
      invalid("water_type", "um tipo compatível com a categoria da etapa");
    }
    if (
      resourceName === "operations" &&
      values.group_id &&
      values.boundary === "external"
    ) {
      invalid("group_id", "um grupo apenas para etapas internas");
    }
  }
  if (resourceName === "flows") {
    for (const field of ["source_boundary", "target_boundary", "water_reuse"]) {
      if (values[field] === null) invalid(field, "verdadeiro ou falso");
    }
    for (const side of ["source", "target"]) {
      const endpoints = [
        values[`${side}_operation_id`],
        values[`${side}_group_id`],
        values[`${side}_boundary`] === true,
      ].filter(Boolean);
      if (endpoints.length !== 1) {
        invalid(side, "uma única etapa, grupo ou fronteira");
      }
    }
    if (
      (values.source_boundary && values.target_boundary) ||
      (values.source_operation_id &&
        values.source_operation_id === values.target_operation_id) ||
      (values.source_group_id &&
        values.source_group_id === values.target_group_id)
    ) {
      invalid("target", "um destino diferente da origem");
    }
  }
}

function buildSearchConditions(query, columns, values) {
  const tokens = String(query ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  return tokens.map((token) => {
    values.push(`%${token.replace(/[\\%_]/g, "\\$&")}%`);
    return `(${columns.map((column) => `${column} ILIKE $${values.length}`).join(" OR ")})`;
  });
}

async function searchEquipmentCatalog(query) {
  const modelValues = [];
  const modelConditions = buildSearchConditions(
    query,
    [
      "equipments_names.name",
      "equipments_categories.category",
      "equipment_catalog.brand",
      "equipment_catalog.model",
    ],
    modelValues,
  );

  const models = await database.query({
    text: `
      SELECT
        equipment_catalog.id,
        equipment_catalog.name_id,
        equipments_names.name,
        equipments_categories.category,
        equipment_catalog.brand,
        equipment_catalog.model,
        equipment_catalog.power,
        equipment_catalog.capacity,
        equipment_catalog.mobility
      FROM equipment_catalog
      JOIN equipments_names ON equipments_names.id = equipment_catalog.name_id
      JOIN equipments_categories
        ON equipments_categories.id = equipments_names.category_id
      WHERE equipment_catalog.active
        AND equipments_names.active
        AND equipments_categories.active
        ${modelConditions.map((condition) => `AND ${condition}`).join(" ")}
      ORDER BY equipments_names.name ASC, equipment_catalog.brand ASC,
        equipment_catalog.model ASC
      LIMIT 15;
    `,
    values: modelValues,
  });

  const nameValues = [];
  const nameConditions = buildSearchConditions(
    query,
    ["equipments_names.name", "equipments_categories.category"],
    nameValues,
  );

  const names = await database.query({
    text: `
      SELECT
        equipments_names.id,
        equipments_names.name,
        equipments_categories.category
      FROM equipments_names
      JOIN equipments_categories
        ON equipments_categories.id = equipments_names.category_id
      WHERE equipments_names.active
        AND equipments_categories.active
        ${nameConditions.map((condition) => `AND ${condition}`).join(" ")}
      ORDER BY equipments_categories.category ASC, equipments_names.name ASC
      LIMIT 10;
    `,
    values: nameValues,
  });

  return { models: models.rows, names: names.rows };
}

async function ensureCanRead(requestingUser, projectId) {
  await project.findOneById(projectId);
  await project.ensureRequesterIsMemberOrThrowForbidden(
    projectId,
    requestingUser,
  );
}

async function ensureCanEdit(requestingUser, projectId) {
  await ensureCanRead(requestingUser, projectId);
  const membership = await project.getMembershipByUserId(
    projectId,
    requestingUser.id,
  );

  if (!EDITOR_ROLES.includes(membership.role)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para editar o MCE deste projeto.",
      action: "Apenas owner, admin ou member do projeto podem editar o MCE.",
    });
  }
}

async function findByProjectId(projectId) {
  const results = await database.query({
    text: `SELECT * FROM mces WHERE project_id = $1 LIMIT 1;`,
    values: [projectId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Este projeto ainda não possui MCE.",
      action: "Crie o MCE do projeto antes de continuar.",
      status_code: 404,
    });
  }

  return results.rows[0];
}

async function getMce(requestingUser, projectId) {
  await ensureCanRead(requestingUser, projectId);
  return await findByProjectId(projectId);
}

async function createMce(requestingUser, projectId) {
  await ensureCanEdit(requestingUser, projectId);

  const results = await database.query({
    text: `
      INSERT INTO mces (project_id)
      VALUES ($1)
      ON CONFLICT (project_id) DO NOTHING
      RETURNING *;
    `,
    values: [projectId],
  });

  if (results.rowCount === 0) {
    throw new ConflictError({
      message: "Este projeto já possui MCE.",
      action: "Utilize o MCE existente do projeto.",
    });
  }

  return results.rows[0];
}

async function updateMce(requestingUser, projectId, input) {
  await ensureCanEdit(requestingUser, projectId);

  if (!MCE_STATUSES.includes(input?.status)) {
    throw new ValidationError({
      name: "ValidationError",
      message: "Status do MCE inválido.",
      action: `Use um destes valores em 'status': ${MCE_STATUSES.join(", ")}.`,
      status_code: 400,
    });
  }

  await findByProjectId(projectId);

  const results = await database.query({
    text: `
      UPDATE mces
      SET status = $2, updated_at = timezone('utc', now())
      WHERE project_id = $1
      RETURNING *;
    `,
    values: [projectId, input.status],
  });

  return results.rows[0];
}

async function listItems(resourceName, requestingUser, projectId) {
  const resource = getResource(resourceName);
  await ensureCanRead(requestingUser, projectId);
  const mce = await findByProjectId(projectId);

  const results = await database.query({
    text: `
      ${resource.selectSql}
      WHERE ${scopeCondition(resource, "$1")}
      ORDER BY ${resource.orderBy};
    `,
    values: [mce.id],
  });

  return results.rows;
}

async function findItem(resourceName, mceId, itemId) {
  const resource = getResource(resourceName);
  const results = await database.query({
    text: `${resource.selectSql} WHERE ${resource.table}.id = $1 AND ${scopeCondition(resource, "$2")};`,
    values: [isUuid(itemId) ? itemId : null, mceId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: `${resource.label} não encontrado.`,
      action: `Verifique o ID do ${resource.label.toLowerCase()} informado.`,
      status_code: 404,
    });
  }

  return results.rows[0];
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

async function getItem(resourceName, requestingUser, projectId, itemId) {
  await ensureCanRead(requestingUser, projectId);
  const mce = await findByProjectId(projectId);
  return await findItem(resourceName, mce.id, itemId);
}

async function createItem(resourceName, requestingUser, projectId, input) {
  const resource = getResource(resourceName);
  await ensureCanEdit(requestingUser, projectId);
  const mce = await findByProjectId(projectId);
  const { fields, details } = splitDetails(resource, input);
  const values = parseValues(resource, fields, { partial: false });
  validateFlowchartResource(resourceName, values);
  await validateUnits(resource.fields, values);
  await validateOneOf(resource, values);
  if (values.name_id) {
    values.custom_name = null;
  }

  await validateReferences(resource, mce.id, values, values);

  const ownedByMce = !resource.scope;
  const columns = [...(ownedByMce ? ["mce_id"] : []), ...Object.keys(values)];
  const placeholders = columns.map((_, index) => `$${index + 1}`);

  const results = await database.query({
    text: `
      INSERT INTO ${resource.table} (${columns.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *;
    `,
    values: [...(ownedByMce ? [mce.id] : []), ...Object.values(values)],
  });

  await saveDetails(resource, results.rows[0].id, values.category, details);

  return await findItem(resourceName, mce.id, results.rows[0].id);
}

async function updateItem(
  resourceName,
  requestingUser,
  projectId,
  itemId,
  input,
) {
  const resource = getResource(resourceName);
  await ensureCanEdit(requestingUser, projectId);
  const mce = await findByProjectId(projectId);
  const existing = await findItem(resourceName, mce.id, itemId);
  const { fields, details } = splitDetails(resource, input);
  const values =
    details !== undefined && Object.keys(fields).length === 0
      ? {}
      : parseValues(resource, fields, { partial: true });
  rejectImmutableChanges(resource, existing, values);
  validateFlowchartResource(resourceName, { ...existing, ...values });
  await validateUnits(resource.fields, values);
  await validateOneOf(resource, values, { ...existing, ...values });
  await validateReferences(
    resource,
    mce.id,
    { ...existing, ...values },
    values,
  );
  if (values.name_id) {
    values.custom_name = null;
  }

  const assignments = [
    ...Object.keys(values).map((column, index) => `${column} = $${index + 3}`),
    "updated_at = timezone('utc', now())",
  ];

  await database.query({
    text: `
      UPDATE ${resource.table}
      SET ${assignments.join(", ")}
      WHERE id = $1 AND ${scopeCondition(resource, "$2")};
    `,
    values: [itemId, mce.id, ...Object.values(values)],
  });

  if (resource.subtypes) {
    const category =
      values.category !== undefined ? values.category : existing.category;
    await saveDetails(resource, itemId, category, details);
  }

  return await findItem(resourceName, mce.id, itemId);
}

async function removeItem(resourceName, requestingUser, projectId, itemId) {
  const resource = getResource(resourceName);
  await ensureCanEdit(requestingUser, projectId);
  const mce = await findByProjectId(projectId);
  const existing = await findItem(resourceName, mce.id, itemId);

  try {
    await database.query({
      text: `DELETE FROM ${resource.table} WHERE id = $1 AND ${scopeCondition(resource, "$2")};`,
      values: [itemId, mce.id],
    });
  } catch (error) {
    if (
      resourceName === "operation_groups" &&
      error.cause?.code === "23503" &&
      ["flows_source_group_fkey", "flows_target_group_fkey"].includes(
        error.cause.constraint,
      )
    ) {
      throw new ConflictError({
        message: "O grupo possui fluxos conectados.",
        action: "Reconecte ou remova esses fluxos antes de excluir o grupo.",
      });
    }
    throw error;
  }

  return existing;
}

const mce = {
  getMce,
  createMce,
  updateMce,
  listItems,
  getItem,
  createItem,
  updateItem,
  removeItem,
  searchEquipmentCatalog,
};

export default mce;

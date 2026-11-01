import database from "infra/database.js";
import project from "models/project.js";
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

const RESOURCES = {
  flowcharts: {
    table: "flowcharts",
    label: "Fluxograma",
    required: ["name"],
    selectSql: "SELECT flowcharts.* FROM flowcharts",
    fields: {
      name: text("name", 254),
      activity: text("activity"),
      description: text("description"),
    },
    orderBy: "name ASC, created_at ASC",
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
      text: `SELECT name_id FROM equipment_models WHERE id = $1 AND active;`,
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
      "equipment_models.brand",
      "equipment_models.model",
    ],
    modelValues,
  );

  const models = await database.query({
    text: `
      SELECT
        equipment_models.id,
        equipment_models.name_id,
        equipments_names.name,
        equipments_categories.category,
        equipment_models.brand,
        equipment_models.model,
        equipment_models.power,
        equipment_models.capacity,
        equipment_models.mobility
      FROM equipment_models
      JOIN equipments_names ON equipments_names.id = equipment_models.name_id
      JOIN equipments_categories
        ON equipments_categories.id = equipments_names.category_id
      WHERE equipment_models.active
        AND equipments_names.active
        AND equipments_categories.active
        ${modelConditions.map((condition) => `AND ${condition}`).join(" ")}
      ORDER BY equipments_names.name ASC, equipment_models.brand ASC,
        equipment_models.model ASC
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
      WHERE ${resource.table}.mce_id = $1
      ORDER BY ${resource.orderBy};
    `,
    values: [mce.id],
  });

  return results.rows;
}

async function findItem(resourceName, mceId, itemId) {
  const resource = getResource(resourceName);
  const results = await database.query({
    text: `${resource.selectSql} WHERE ${resource.table}.id = $1 AND ${resource.table}.mce_id = $2;`,
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
  const values = parseValues(resource, input, { partial: false });
  await validateOneOf(resource, values);
  if (values.name_id) {
    values.custom_name = null;
  }

  const columns = ["mce_id", ...Object.keys(values)];
  const placeholders = columns.map((_, index) => `$${index + 1}`);

  const results = await database.query({
    text: `
      INSERT INTO ${resource.table} (${columns.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *;
    `,
    values: [mce.id, ...Object.values(values)],
  });

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
  const values = parseValues(resource, input, { partial: true });
  await validateOneOf(resource, values, { ...existing, ...values });
  if (values.name_id) {
    values.custom_name = null;
  }

  const assignments = Object.keys(values).map(
    (column, index) => `${column} = $${index + 3}`,
  );

  const results = await database.query({
    text: `
      UPDATE ${resource.table}
      SET ${assignments.join(", ")}, updated_at = timezone('utc', now())
      WHERE id = $1 AND mce_id = $2
      RETURNING *;
    `,
    values: [itemId, mce.id, ...Object.values(values)],
  });

  return await findItem(resourceName, mce.id, itemId);
}

async function removeItem(resourceName, requestingUser, projectId, itemId) {
  const resource = getResource(resourceName);
  await ensureCanEdit(requestingUser, projectId);
  const mce = await findByProjectId(projectId);
  const existing = await findItem(resourceName, mce.id, itemId);

  await database.query({
    text: `DELETE FROM ${resource.table} WHERE id = $1 AND mce_id = $2;`,
    values: [itemId, mce.id],
  });

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

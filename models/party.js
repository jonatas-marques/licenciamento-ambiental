import database from "infra/database.js";
import project from "models/project.js";
import person from "models/person.js";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "infra/errors.js";

const LEGAL_RESPONSIBLE_INTEREST = "responsável legal";
const ENVIRONMENTAL_CONSULTANCY_INTEREST = "consultoria ambiental";
const FULL_ACCESS_INTERESTS = [
  LEGAL_RESPONSIBLE_INTEREST,
  ENVIRONMENTAL_CONSULTANCY_INTEREST,
];
const MANAGER_ROLES = ["owner", "admin"];
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const partySelection = (partyAlias) => `
  ${partyAlias}.*,
  COALESCE(natural_persons.name, legal_persons.name) AS person_name,
  CASE
    WHEN natural_persons.id IS NOT NULL THEN 'natural'
    WHEN legal_persons.id IS NOT NULL THEN 'legal'
  END AS person_type,
  COALESCE(natural_persons.cpf, legal_persons.cnpj) AS person_document
`;

const partyPersonJoins = (partyAlias) => `
  LEFT JOIN natural_persons ON natural_persons.id = ${partyAlias}.person_id
  LEFT JOIN legal_persons ON legal_persons.id = ${partyAlias}.person_id
`;

function validatePersonId(personId) {
  if (typeof personId !== "string" || !UUID_REGEX.test(personId)) {
    throw new ValidationError({
      name: "ValidationError",
      message: "Pessoa inválida.",
      action: "Envie o UUID de uma pessoa física ou jurídica em 'person_id'.",
      status_code: 400,
    });
  }
}

function validateInterest(interest) {
  if (
    !interest ||
    typeof interest !== "string" ||
    interest.trim().length === 0 ||
    interest.trim().length > 32
  ) {
    throw new ValidationError({
      name: "ValidationError",
      message: "Interesse inválido.",
      action: "Envie um texto (até 32 caracteres) em 'interest'.",
      status_code: 400,
    });
  }
}

// Interesses reservados são gravados sempre na forma canônica
function normalizeInterest(interest) {
  const trimmed = interest.trim();
  const canonical = FULL_ACCESS_INTERESTS.find(
    (reserved) => reserved === trimmed.toLowerCase(),
  );

  return canonical ?? trimmed;
}

// Aceita 'person_id' ou, como atalho, 'person_document' (CPF/CNPJ)
async function resolvePersonId(values) {
  if (values?.person_id !== undefined || values?.person_document == null) {
    return values?.person_id;
  }

  const digits = String(values.person_document).replace(/\D/g, "");

  if (digits.length === 11) {
    return (await person.findOneByCpf(digits)).id;
  }

  if (digits.length === 14) {
    return (await person.findOneByCnpj(digits)).id;
  }

  throw new ValidationError({
    name: "ValidationError",
    message: "CPF/CNPJ inválido.",
    action: "Envie 11 (CPF) ou 14 (CNPJ) dígitos em 'person_document'.",
    status_code: 400,
  });
}

async function ensurePersonExistsOrThrow(personId) {
  try {
    await person.findNaturalById(personId);
  } catch (error) {
    if (!(error instanceof NotFoundError)) {
      throw error;
    }

    await person.findLegalById(personId);
  }
}

// Acesso derivado das partes: o usuário (via sua pessoa física) é parte
// diretamente ou é membro ativo de uma pessoa jurídica que é parte.
async function getPartyAccessLevel(projectId, userId) {
  const results = await database.query({
    text: `
      SELECT parties.interest
      FROM parties
      WHERE parties.project_id = $1
        AND (
          parties.person_id IN (
            SELECT natural_persons.id
            FROM natural_persons
            WHERE natural_persons.user_id = $2
          )
          OR parties.person_id IN (
            SELECT legal_person_members.legal_person_id
            FROM legal_person_members
            INNER JOIN natural_persons
              ON natural_persons.id = legal_person_members.natural_person_id
            WHERE natural_persons.user_id = $2
              AND legal_person_members.valid_from <= timezone('utc', now())
              AND (
                legal_person_members.valid_to IS NULL
                OR legal_person_members.valid_to >= timezone('utc', now())
              )
          )
        );
    `,
    values: [projectId, userId],
  });

  if (results.rowCount === 0) {
    return null;
  }

  const hasFullAccess = results.rows.some((row) =>
    FULL_ACCESS_INTERESTS.includes(row.interest),
  );

  return hasFullAccess ? "full" : "viewer";
}

async function getProjectMemberAccessLevel(projectId, userId) {
  try {
    const membership = await project.getMembershipByUserId(projectId, userId);
    return MANAGER_ROLES.includes(membership.role) ? "full" : "viewer";
  } catch (error) {
    if (error instanceof NotFoundError) {
      return null;
    }
    throw error;
  }
}

// "full" | "viewer" | null, combinando project_members e partes
async function getUserAccessLevel(projectId, userId) {
  const [memberLevel, partyLevel] = await Promise.all([
    getProjectMemberAccessLevel(projectId, userId),
    getPartyAccessLevel(projectId, userId),
  ]);

  if (memberLevel === "full" || partyLevel === "full") {
    return "full";
  }

  return memberLevel ?? partyLevel;
}

async function ensureCanReadParties(projectId, requestingUser) {
  const level = await getUserAccessLevel(projectId, requestingUser.id);

  if (!level) {
    throw new ForbiddenError({
      message: "Você não é membro nem parte interessada deste projeto.",
      action: "Solicite acesso ao responsável pelo projeto.",
    });
  }
}

async function ensureCanManageParties(projectId, requestingUser) {
  const level = await getUserAccessLevel(projectId, requestingUser.id);

  if (!level) {
    await ensureCanReadParties(projectId, requestingUser);
  }

  if (level !== "full") {
    throw new ForbiddenError({
      message:
        "Você não possui permissão para gerenciar partes interessadas do projeto.",
      action:
        "Apenas owner, admin, responsável legal ou consultoria ambiental do projeto podem gerenciar partes interessadas.",
    });
  }
}

async function ensureAnotherLegalResponsibleExists(projectId, partyId) {
  const results = await database.query({
    text: `
      SELECT id
      FROM parties
      WHERE project_id = $1
        AND id <> $2
        AND interest = $3
      LIMIT 1;
    `,
    values: [projectId, partyId, LEGAL_RESPONSIBLE_INTEREST],
  });

  if (results.rowCount === 0) {
    throw new ValidationError({
      name: "ValidationError",
      message: "O projeto precisa de ao menos um responsável legal.",
      action:
        "Cadastre outro responsável legal antes de remover ou alterar este.",
      status_code: 400,
    });
  }
}

async function validateUniqueParty(projectId, personId) {
  const results = await database.query({
    text: `
      SELECT id
      FROM parties
      WHERE project_id = $1
        AND person_id = $2
      LIMIT 1;
    `,
    values: [projectId, personId],
  });

  if (results.rowCount > 0) {
    throw new ValidationError({
      name: "ValidationError",
      message: "Pessoa já é parte interessada neste projeto.",
      action:
        "Tente cadastrar outra pessoa ou remova a parte interessada existente.",
      status_code: 400,
    });
  }
}

function throwPartyNotFound() {
  throw new NotFoundError({
    name: "NotFoundError",
    message: "Parte interessada não encontrada.",
    action: "Verifique o ID do projeto e da parte interessada informado.",
    status_code: 404,
  });
}

async function listParties(requestingUser, projectId) {
  await project.findOneById(projectId);
  await ensureCanReadParties(projectId, requestingUser);

  const results = await database.query({
    text: `
      SELECT ${partySelection("parties")}
      FROM parties
      ${partyPersonJoins("parties")}
      WHERE parties.project_id = $1
      ORDER BY parties.interest ASC, person_name ASC;
    `,
    values: [projectId],
  });

  return results.rows;
}

async function getParty(requestingUser, projectId, partyId) {
  await project.findOneById(projectId);
  await ensureCanReadParties(projectId, requestingUser);

  return await findPartyOrThrow(projectId, partyId);
}

async function findPartyOrThrow(projectId, partyId) {
  if (!UUID_REGEX.test(String(partyId))) {
    throwPartyNotFound();
  }

  const results = await database.query({
    text: `
      SELECT ${partySelection("parties")}
      FROM parties
      ${partyPersonJoins("parties")}
      WHERE parties.project_id = $1
        AND parties.id = $2
      LIMIT 1;
    `,
    values: [projectId, partyId],
  });

  if (results.rowCount === 0) {
    throwPartyNotFound();
  }

  return results.rows[0];
}

async function addParty(requestingUser, projectId, userInputValues) {
  await project.findOneById(projectId);
  await ensureCanManageParties(projectId, requestingUser);

  const personId = await resolvePersonId(userInputValues);
  validatePersonId(personId);

  const interest = userInputValues?.interest;
  validateInterest(interest);

  await ensurePersonExistsOrThrow(personId);
  await validateUniqueParty(projectId, personId);

  const results = await database.query({
    text: `
      WITH inserted_party AS (
        INSERT INTO parties (project_id, person_id, interest)
        VALUES ($1, $2, $3)
        RETURNING *
      )
      SELECT ${partySelection("inserted_party")}
      FROM inserted_party
      ${partyPersonJoins("inserted_party")};
    `,
    values: [projectId, personId, normalizeInterest(interest)],
  });

  return results.rows[0];
}

async function updateParty(requestingUser, projectId, partyId, patchValues) {
  await project.findOneById(projectId);
  await ensureCanManageParties(projectId, requestingUser);

  // garante que existe e pertence ao projeto
  const current = await findPartyOrThrow(projectId, partyId);

  const fields = [];
  const values = [projectId, partyId];
  let idx = 3;

  if (
    "person_id" in (patchValues ?? {}) ||
    "person_document" in (patchValues ?? {})
  ) {
    const personId = await resolvePersonId(patchValues);
    validatePersonId(personId);
    await ensurePersonExistsOrThrow(personId);

    if (personId !== current.person_id) {
      await validateUniqueParty(projectId, personId);
    }

    fields.push(`person_id = $${idx++}`);
    values.push(personId);
  }

  if ("interest" in (patchValues ?? {})) {
    validateInterest(patchValues.interest);
    const interest = normalizeInterest(patchValues.interest);

    if (
      current.interest === LEGAL_RESPONSIBLE_INTEREST &&
      interest !== LEGAL_RESPONSIBLE_INTEREST
    ) {
      await ensureAnotherLegalResponsibleExists(projectId, partyId);
    }

    fields.push(`interest = $${idx++}`);
    values.push(interest);
  }

  if (fields.length === 0) {
    throw new ValidationError({
      name: "ValidationError",
      message: "Nenhum campo para atualizar.",
      action: "Envie ao menos 'interest' ou 'person_id' no body.",
      status_code: 400,
    });
  }

  const results = await database.query({
    text: `
      WITH updated_party AS (
        UPDATE parties
        SET ${fields.join(", ")}
        WHERE project_id = $1
          AND id = $2
        RETURNING *
      )
      SELECT ${partySelection("updated_party")}
      FROM updated_party
      ${partyPersonJoins("updated_party")};
    `,
    values,
  });

  if (results.rowCount === 0) {
    throwPartyNotFound();
  }

  return results.rows[0];
}

async function removeParty(requestingUser, projectId, partyId) {
  await project.findOneById(projectId);
  await ensureCanManageParties(projectId, requestingUser);

  const current = await findPartyOrThrow(projectId, partyId);

  if (current.interest === LEGAL_RESPONSIBLE_INTEREST) {
    await ensureAnotherLegalResponsibleExists(projectId, partyId);
  }

  const results = await database.query({
    text: `
      DELETE FROM parties
      WHERE project_id = $1
        AND id = $2
      RETURNING *;
    `,
    values: [projectId, partyId],
  });

  if (results.rowCount === 0) {
    throwPartyNotFound();
  }

  return { ...current, ...results.rows[0] };
}

const party = {
  listParties,
  getParty,
  addParty,
  updateParty,
  removeParty,
  getUserAccessLevel,
  LEGAL_RESPONSIBLE_INTEREST,
  ENVIRONMENTAL_CONSULTANCY_INTEREST,
};

export default party;

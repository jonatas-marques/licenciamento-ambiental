import database from "infra/database.js";
import project from "models/project.js";
import person from "models/person.js";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "infra/errors.js";

const MANAGER_ROLES = ["owner", "admin"];

function sanitizePersonCp(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function validatePersonCp(personCp) {
  if (!personCp || typeof personCp !== "string") {
    throw new ValidationError({
      name: "ValidationError",
      message: "CPF/CNPJ inválido.",
      action:
        "Envie apenas números com 11 (CPF) ou 14 (CNPJ) dígitos em 'person_cp'.",
      status_code: 400,
    });
  }

  const isCpf = /^\d{11}$/.test(personCp);
  const isCnpj = /^\d{14}$/.test(personCp);

  if (!isCpf && !isCnpj) {
    throw new ValidationError({
      name: "ValidationError",
      message: "CPF/CNPJ inválido.",
      action:
        "Envie apenas números com 11 (CPF) ou 14 (CNPJ) dígitos em 'person_cp'.",
      status_code: 400,
    });
  }
}

function validateInterest(interest) {
  if (
    !interest ||
    typeof interest !== "string" ||
    interest.trim().length === 0 ||
    interest.length > 32
  ) {
    throw new ValidationError({
      name: "ValidationError",
      message: "Interesse inválido.",
      action: "Envie um texto (até 32 caracteres) em 'interest'.",
      status_code: 400,
    });
  }
}

async function ensurePersonExistsOrThrow(personCp) {
  // person_cp é CPF (11) ou CNPJ (14)
  if (personCp.length === 11) {
    await person.findOneByCPF(personCp);
    return;
  }
  await person.findOneByCNPJ(personCp);
}

async function getRequesterMembership(projectId, requestingUser) {
  // Reaproveita a lógica (e mensagens) do domínio project_members.
  return await project.getMember(requestingUser, projectId, requestingUser.id);
}

function ensureCanManageParties(requesterMembership) {
  if (!MANAGER_ROLES.includes(requesterMembership.role)) {
    throw new ForbiddenError({
      message:
        "Você não possui permissão para gerenciar partes interessadas do projeto.",
      action:
        "Apenas usuários com role 'owner' ou 'admin' podem gerenciar partes interessadas.",
    });
  }
}

async function validateUniqueParty(projectId, personCp) {
  const results = await database.query({
    text: `
      SELECT id
      FROM parties
      WHERE project_id = $1
        AND person_cp = $2
      LIMIT 1;
    `,
    values: [projectId, personCp],
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

async function listParties(requestingUser, projectId) {
  await project.findOneById(projectId);
  await getRequesterMembership(projectId, requestingUser);

  const results = await database.query({
    text: `
      SELECT *
      FROM parties
      WHERE project_id = $1
      ORDER BY interest ASC, person_cp ASC;
    `,
    values: [projectId],
  });

  return results.rows;
}

async function getParty(requestingUser, projectId, partyId) {
  await project.findOneById(projectId);
  await getRequesterMembership(projectId, requestingUser);

  const results = await database.query({
    text: `
      SELECT *
      FROM parties
      WHERE project_id = $1
        AND id = $2
      LIMIT 1;
    `,
    values: [projectId, partyId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      name: "NotFoundError",
      message: "Parte interessada não encontrada.",
      action: "Verifique o ID do projeto e da parte interessada informado.",
      status_code: 404,
    });
  }

  return results.rows[0];
}

async function addParty(requestingUser, projectId, userInputValues) {
  await project.findOneById(projectId);
  const requesterMembership = await getRequesterMembership(
    projectId,
    requestingUser,
  );
  ensureCanManageParties(requesterMembership);

  const rawCp = userInputValues?.person_cp;
  const sanitizedCp = sanitizePersonCp(rawCp);
  validatePersonCp(sanitizedCp);

  const interest = userInputValues?.interest;
  validateInterest(interest);

  await ensurePersonExistsOrThrow(sanitizedCp);
  await validateUniqueParty(projectId, sanitizedCp);

  const results = await database.query({
    text: `
      INSERT INTO parties (project_id, person_cp, interest)
      VALUES ($1, $2, $3)
      RETURNING *;
    `,
    values: [projectId, sanitizedCp, interest],
  });

  return results.rows[0];
}

async function updateParty(requestingUser, projectId, partyId, patchValues) {
  await project.findOneById(projectId);
  const requesterMembership = await getRequesterMembership(
    projectId,
    requestingUser,
  );
  ensureCanManageParties(requesterMembership);

  // garante que existe e pertence ao projeto
  const current = await getParty(requestingUser, projectId, partyId);

  const fields = [];
  const values = [projectId, partyId];
  let idx = 3;

  if ("person_cp" in (patchValues ?? {})) {
    const sanitizedCp = sanitizePersonCp(patchValues.person_cp);
    validatePersonCp(sanitizedCp);
    await ensurePersonExistsOrThrow(sanitizedCp);

    if (sanitizedCp !== current.person_cp) {
      await validateUniqueParty(projectId, sanitizedCp);
    }

    fields.push(`person_cp = $${idx++}`);
    values.push(sanitizedCp);
  }

  if ("interest" in (patchValues ?? {})) {
    validateInterest(patchValues.interest);
    fields.push(`interest = $${idx++}`);
    values.push(patchValues.interest);
  }

  if (fields.length === 0) {
    throw new ValidationError({
      name: "ValidationError",
      message: "Nenhum campo para atualizar.",
      action: "Envie ao menos 'interest' ou 'person_cp' no body.",
      status_code: 400,
    });
  }

  const results = await database.query({
    text: `
      UPDATE parties
      SET ${fields.join(", ")}
      WHERE project_id = $1
        AND id = $2
      RETURNING *;
    `,
    values,
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      name: "NotFoundError",
      message: "Parte interessada não encontrada.",
      action: "Verifique o ID do projeto e da parte interessada informado.",
      status_code: 404,
    });
  }

  return results.rows[0];
}

async function removeParty(requestingUser, projectId, partyId) {
  await project.findOneById(projectId);
  const requesterMembership = await getRequesterMembership(
    projectId,
    requestingUser,
  );
  ensureCanManageParties(requesterMembership);

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
    throw new NotFoundError({
      name: "NotFoundError",
      message: "Parte interessada não encontrada.",
      action: "Verifique o ID do projeto e da parte interessada informado.",
      status_code: 404,
    });
  }

  return results.rows[0];
}

const party = {
  listParties,
  getParty,
  addParty,
  updateParty,
  removeParty,
};

export default party;

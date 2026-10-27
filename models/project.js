import database from "infra/database.js";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "infra/errors.js";

const allowedMemberRoles = ["owner", "admin", "member", "viewer"];
const allowedProjectStatuses = ["active", "archived"];

function validateCreateInput(inputValues) {
  validateObject(inputValues);
  validateAllowedFields(inputValues, ["name"]);
  validateProjectName(inputValues.name);
}

function validateUpdateInput(inputValues) {
  validateObject(inputValues);
  validateAllowedFields(inputValues, ["name", "status"]);

  if (Object.keys(inputValues).length === 0) {
    throw new ValidationError({
      message: "Nenhum campo para atualizar.",
      action: "Informe ao menos 'name' ou 'status'.",
    });
  }

  if ("name" in inputValues) {
    validateProjectName(inputValues.name);
  }

  if (
    "status" in inputValues &&
    !allowedProjectStatuses.includes(inputValues.status)
  ) {
    throw new ValidationError({
      message: "Status inválido para o projeto.",
      action: "Use 'active' ou 'archived'.",
    });
  }
}

function validateObject(inputValues) {
  if (
    !inputValues ||
    typeof inputValues !== "object" ||
    Array.isArray(inputValues)
  ) {
    throw new ValidationError({
      message: "Dados do projeto inválidos.",
      action: "Envie um objeto JSON com os campos permitidos.",
    });
  }
}

function validateAllowedFields(inputValues, allowedFields) {
  const unexpectedFields = Object.keys(inputValues).filter(
    (field) => !allowedFields.includes(field),
  );

  if (unexpectedFields.length > 0) {
    throw new ValidationError({
      message: "A operação contém campos não permitidos.",
      action: `Remova os campos não aceitos: ${unexpectedFields.join(", ")}.`,
    });
  }
}

function validateProjectName(name) {
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.trim().length > 254
  ) {
    throw new ValidationError({
      message: "Nome do projeto inválido.",
      action: "Informe um nome com até 254 caracteres.",
    });
  }
}

async function findOneById(projectId) {
  const results = await database.query({
    text: `
      SELECT 
        *
      FROM 
        projects
      WHERE 
        id = $1
      ;`,
    values: [projectId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Projeto não encontrado.",
      action: "Verifique o ID do projeto informado.",
      status_code: 404,
    });
  }

  return results.rows[0];
}

async function listByUserId(userId) {
  const results = await database.query({
    text: `
      SELECT projects.*
      FROM projects
      INNER JOIN project_members
        ON project_members.project_id = projects.id
      WHERE project_members.user_id = $1
        AND project_members.valid_from <= timezone('utc', now())
        AND (
          project_members.valid_to IS NULL
          OR project_members.valid_to >= timezone('utc', now())
        )
      ORDER BY projects.name ASC;
    `,
    values: [userId],
  });

  return results.rows;
}

async function create(newProjectInputValues) {
  validateProjectName(newProjectInputValues.name);
  await validateUniqueName(newProjectInputValues.name);

  return database.transaction(async (client) => {
    const projectResults = await client.query({
      text: `
        INSERT INTO projects (name, created_by, updated_by)
        VALUES ($1, $2, $2)
        RETURNING *;
      `,
      values: [
        newProjectInputValues.name.trim(),
        newProjectInputValues.created_by,
      ],
    });

    const createdProject = projectResults.rows[0];

    await client.query({
      text: `
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, $3);
      `,
      values: [createdProject.id, newProjectInputValues.created_by, "owner"],
    });

    return createdProject;
  });
}

async function validateUniqueName(name) {
  const results = await database.query({
    text: `
      SELECT 
        id
      FROM 
        projects
      WHERE 
        name = $1
      ;`,
    values: [name.trim()],
  });

  if (results.rowCount > 0) {
    throw new ValidationError({
      name: "ValidationError",
      message: "Nome já está em uso.",
      action: "Utilize outro nome para realizar esta operação.",
      status_code: 400,
    });
  }
}

async function update(id, userInputValues, updatedBy) {
  validateUpdateInput(userInputValues);
  const currentProject = await findOneById(id);

  if (
    "name" in userInputValues &&
    userInputValues.name.trim() !== currentProject.name
  ) {
    await validateUniqueName(userInputValues.name);
  }

  const fields = [];
  const values = [id];
  let nextIndex = 2;

  if ("name" in userInputValues) {
    fields.push(`name = $${nextIndex++}`);
    values.push(userInputValues.name.trim());
  }

  if ("status" in userInputValues) {
    fields.push(`status = $${nextIndex++}`);
    values.push(userInputValues.status);
  }

  fields.push(`updated_by = $${nextIndex++}`);
  values.push(updatedBy);
  fields.push("updated_at = timezone('utc'::text, now())");

  const results = await database.query({
    text: `
      UPDATE projects
      SET ${fields.join(", ")}
      WHERE id = $1
      RETURNING *;
    `,
    values,
  });
  return results.rows[0];
}

async function getMembership(projectId, member) {
  const membershipFound = await runSelectQuery(projectId, member);
  return membershipFound;

  async function runSelectQuery(projectId, member) {
    const results = await database.query({
      text: `
      SELECT 
        *
      FROM 
        project_members
      WHERE 
        project_id = $1 AND user_id = $2
      LIMIT
        1
      ;`,
      values: [projectId, member.id],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({
        name: "NotFoundError",
        message: "Membro do projeto não encontrado.",
        action: "Verifique o ID do projeto e do usuário informado.",
        status_code: 404,
      });
    }
    return results.rows[0];
  }
}

async function addMember(requestingUser, userInputValues) {
  validateMemberRole(userInputValues.role);

  await validateUniqueMember(
    userInputValues.project_id,
    userInputValues.user_id,
  );

  const memberTryingToAdd = await getMembershipByUserId(
    userInputValues.project_id,
    requestingUser.id,
  );

  ensureCanManageMembers(memberTryingToAdd);

  if (userInputValues.role === "owner") {
    ensureCanManageOwner(memberTryingToAdd);
  }

  const addedMember = await runInsertQuery(userInputValues);
  return addedMember;

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
        INSERT INTO 
            project_members (project_id, user_id, role) 
        VALUES 
            ($1, $2, $3)
        RETURNING 
            *
        ;`,
      values: [
        userInputValues.project_id,
        userInputValues.user_id,
        userInputValues.role,
      ],
    });
    return results.rows[0];
  }
}

async function validateUniqueMember(projectId, memberId) {
  const results = await database.query({
    text: `
      SELECT 
        id
      FROM 
        project_members
      WHERE 
        project_id = $1 AND user_id = $2
      ;`,
    values: [projectId, memberId],
  });

  if (results.rowCount > 0) {
    throw new ValidationError({
      name: "ValidationError",
      message: "Usuário já é membro do projeto.",
      action: "Tente adicionar outro usuário ao projeto.",
      status_code: 400,
    });
  }
}

function validateMemberRole(role) {
  if (!allowedMemberRoles.includes(role)) {
    throw new ValidationError({
      message: "Role inválida para membro do projeto.",
      action: `Use um destes valores: ${allowedMemberRoles.join(", ")}.`,
    });
  }
}

async function getMembershipByUserId(projectId, userId) {
  const results = await database.query({
    text: `
      SELECT *
      FROM project_members
      WHERE project_id = $1
        AND user_id = $2
        AND valid_from <= timezone('utc', now())
        AND (valid_to IS NULL OR valid_to >= timezone('utc', now()))
      LIMIT 1;
    `,
    values: [projectId, userId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Membro do projeto não encontrado.",
      action: "Verifique o ID do projeto e do usuário informado.",
      status_code: 404,
    });
  }

  return results.rows[0];
}

async function ensureRequesterIsMemberOrThrowForbidden(
  projectId,
  requestingUser,
) {
  try {
    await getMembershipByUserId(projectId, requestingUser.id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new ForbiddenError({
        message: "Você não é membro deste projeto.",
        action: "Solicite acesso ao proprietário do projeto.",
      });
    }
    throw error;
  }
}

async function ensureCanUpdateProject(projectId, requestingUser) {
  await ensureRequesterIsMemberOrThrowForbidden(projectId, requestingUser);

  const requesterMembership = await getMembershipByUserId(
    projectId,
    requestingUser.id,
  );

  if (!["owner", "admin"].includes(requesterMembership.role)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar esse projeto.",
      action:
        "Apenas owner ou admin do projeto podem atualizar os dados do projeto.",
    });
  }
}

async function ensureAnotherActiveOwnerExists(projectId, excludedUserId) {
  const results = await database.query({
    text: `
      SELECT id
      FROM project_members
      WHERE project_id = $1
        AND user_id <> $2
        AND role = 'owner'
        AND valid_from <= timezone('utc', now())
        AND (valid_to IS NULL OR valid_to >= timezone('utc', now()))
      LIMIT 1;
    `,
    values: [projectId, excludedUserId],
  });

  if (results.rowCount === 0) {
    throw new ValidationError({
      message: "O projeto precisa ter ao menos um proprietário ativo.",
      action: "Adicione outro proprietário antes de remover ou rebaixar este.",
    });
  }
}

function ensureCanManageMembers(requesterMembership) {
  if (!["owner", "admin"].includes(requesterMembership.role)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para gerenciar membros do projeto.",
      action:
        "Apenas usuários com role 'owner' ou 'admin' podem gerenciar membros.",
    });
  }
}

function ensureCanManageOwner(requesterMembership) {
  if (requesterMembership.role !== "owner") {
    throw new ForbiddenError({
      message: "Apenas o owner pode gerenciar outro owner.",
      action: "Solicite ao proprietário do projeto para executar esta ação.",
    });
  }
}

async function listMembers(requestingUser, projectId) {
  await findOneById(projectId);
  await ensureRequesterIsMemberOrThrowForbidden(projectId, requestingUser);

  const results = await database.query({
    text: `
      SELECT *
      FROM project_members
      WHERE project_id = $1
        AND valid_from <= timezone('utc', now())
        AND (valid_to IS NULL OR valid_to >= timezone('utc', now()))
      ORDER BY valid_from ASC;
    `,
    values: [projectId],
  });

  return results.rows;
}

async function getMember(requestingUser, projectId, userId) {
  await findOneById(projectId);
  await ensureRequesterIsMemberOrThrowForbidden(projectId, requestingUser);
  return await getMembershipByUserId(projectId, userId);
}

async function updateMember(requestingUser, projectId, userId, patchValues) {
  await findOneById(projectId);

  const requesterMembership = await getMembershipByUserId(
    projectId,
    requestingUser.id,
  );
  ensureCanManageMembers(requesterMembership);

  const targetMembership = await getMembershipByUserId(projectId, userId);

  // Se estiver mexendo com owner (alterar role de owner ou alterar alguém para owner), só owner pode.
  if (targetMembership.role === "owner") {
    ensureCanManageOwner(requesterMembership);
  }
  if ("role" in patchValues && patchValues.role === "owner") {
    ensureCanManageOwner(requesterMembership);
  }
  if (
    targetMembership.role === "owner" &&
    "role" in patchValues &&
    patchValues.role !== "owner"
  ) {
    await ensureAnotherActiveOwnerExists(projectId, userId);
  }

  const fields = [];
  const values = [projectId, userId];
  let nextIndex = 3;

  if ("role" in patchValues) {
    validateMemberRole(patchValues.role);
    fields.push(`role = $${nextIndex++}`);
    values.push(patchValues.role);
  }

  if ("valid_to" in patchValues) {
    const validTo = patchValues.valid_to;

    if (validTo !== null) {
      const parsed = Date.parse(validTo);
      if (Number.isNaN(parsed)) {
        throw new ValidationError({
          message: "valid_to inválido.",
          action:
            "Envie uma data ISO válida (ex.: 2026-05-03T20:00:00.000Z) ou null.",
        });
      }

      const validFromParsed = Date.parse(targetMembership.valid_from);
      if (!Number.isNaN(validFromParsed) && parsed < validFromParsed) {
        throw new ValidationError({
          message: "valid_to não pode ser anterior a valid_from.",
          action: "Ajuste a data e tente novamente.",
        });
      }
    }

    fields.push(`valid_to = $${nextIndex++}`);
    values.push(validTo);
  }

  if (fields.length === 0) {
    throw new ValidationError({
      message: "Nenhum campo para atualizar.",
      action: "Envie ao menos 'role' ou 'valid_to' no body.",
    });
  }

  const results = await database.query({
    text: `
      UPDATE project_members
      SET ${fields.join(", ")}
      WHERE project_id = $1 AND user_id = $2
      RETURNING *;
    `,
    values,
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Membro do projeto não encontrado.",
      action: "Verifique o ID do projeto e do usuário informado.",
      status_code: 404,
    });
  }

  return results.rows[0];
}

async function removeMember(requestingUser, projectId, userId) {
  await findOneById(projectId);

  const requesterMembership = await getMembershipByUserId(
    projectId,
    requestingUser.id,
  );
  ensureCanManageMembers(requesterMembership);

  const targetMembership = await getMembershipByUserId(projectId, userId);

  // Remover owner: só owner pode
  if (targetMembership.role === "owner") {
    ensureCanManageOwner(requesterMembership);
    await ensureAnotherActiveOwnerExists(projectId, userId);
  }

  const results = await database.query({
    text: `
      DELETE FROM project_members
      WHERE project_id = $1 AND user_id = $2
      RETURNING *;
    `,
    values: [projectId, userId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Membro do projeto não encontrado.",
      action: "Verifique o ID do projeto e do usuário informado.",
      status_code: 404,
    });
  }

  return results.rows[0];
}

const project = {
  listByUserId,
  listMembers,
  getMember,
  updateMember,
  removeMember,
  create,
  update,
  findOneById,
  getMembership,
  ensureRequesterIsMemberOrThrowForbidden,
  ensureCanUpdateProject,
  validateUniqueName,
  validateCreateInput,
  validateUpdateInput,
  addMember,
  validateUniqueMember,
};

export default project;

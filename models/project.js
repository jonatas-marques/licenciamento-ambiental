import database from "infra/database.js";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "infra/errors.js";

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

async function create(newProjectInputValues) {
  await validateUniqueName(newProjectInputValues.name);

  const createdProject = await runInsertQueryIntoProjects(
    newProjectInputValues,
  );

  const projectCreatorMembershipValues = {
    project_id: createdProject.id,
    user_id: newProjectInputValues.created_by,
    role: "owner",
  };
  await runInsertQueryIntoProjectMembers(projectCreatorMembershipValues);
  /**
   * First user to create the project is the owner, so we add
   * the project creator as a member with the "owner" role.
   */
  // Alternativamente rodar insertQuery ? Pode necessitar try para nao criar membros ou projetso órfãos
  // const createdProjectMember = await runInsertQueryIntoProjectMembers(createdProject);

  return createdProject;

  async function runInsertQueryIntoProjects(newProjectInputValues) {
    const results = await database.query({
      text: `
        INSERT INTO 
            projects (name, created_by) 
        VALUES 
            ($1, $2)
        RETURNING 
            *
        ;`,
      values: [newProjectInputValues.name, newProjectInputValues.created_by],
    });
    return results.rows[0];
  }
  async function runInsertQueryIntoProjectMembers(
    projectCreatorMembershipValues,
  ) {
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
        projectCreatorMembershipValues.project_id,
        projectCreatorMembershipValues.user_id,
        projectCreatorMembershipValues.role,
      ],
    });
    return results.rows[0];
  }
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
    values: [name],
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

async function update(id, userInputValues) {
  const currentProject = await findOneById(id);

  if ("name" in userInputValues) {
    await validateUniqueName(userInputValues.name);
  }

  const projectWithNewValues = { ...currentProject, ...userInputValues };

  const updatedProject = await runUpdateQuery(projectWithNewValues);
  return updatedProject;

  async function runUpdateQuery(projectWithNewValues) {
    const results = await database.query({
      text: `
        UPDATE 
            projects
        SET 
            name = $2,
            updated_at = timezone('utc'::text, now())
        WHERE
            id = $1
        RETURNING
            *
        ;`,
      values: [projectWithNewValues.id, projectWithNewValues.name],
    });
    return results.rows[0];
  }
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
  // `add` means `create` membership
  // validade unique member for the project
  await validateUniqueMember(
    // Pode refatorar para utilizar o getMebership()
    userInputValues.project_id,
    userInputValues.user_id,
  );

  const memberTryingToAdd = await getMembership(
    userInputValues.project_id,
    requestingUser,
  );

  if (!["owner", "admin"].includes(memberTryingToAdd.role)) {
    throw new ForbiddenError({
      name: "ForbiddenError",
      message: "Você não possui permissão para adicionar membros ao projeto.",
      action:
        "Apenas usuários com role 'owner' ou 'admin' podem adicionar membros.",
      status_code: 403,
    });
  }
  // Implementation for inserting member into project_members table.
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
// similar to authorization.can() but specific for project members
function toBe(member, role) {
  let authorized = false;

  if (member.role === role) {
    authorized = true;
  }

  return authorized;
}
const allowedMemberRoles = ["owner", "admin", "member", "viewer"];

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
  listMembers,
  getMember,
  updateMember,
  removeMember,
  create,
  update,
  findOneById,
  getMembership,
  validateUniqueName,
  addMember,
  validateUniqueMember,
};

export default project;

import database from "infra/database.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "infra/errors.js";
import project from "models/project.js";

function validateCreateInput(inputValues) {
  validateObject(inputValues);
  validateAllowedFields(inputValues, []);
}

function validateUpdateInput(inputValues) {
  validateObject(inputValues);
  validateAllowedFields(inputValues, ["status"]);

  if (inputValues.status !== "archived") {
    throw new ValidationError({
      message: "Atualização inválida para o MCE.",
      action: "O único status permitido nesta etapa é 'archived'.",
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
      message: "Dados do MCE inválidos.",
      action: "Envie um objeto JSON.",
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

async function assertProjectMember(projectId, userId) {
  await project.findOneById(projectId);

  const membership = await database.query({
    text: `
      SELECT id
      FROM project_members
      WHERE project_id = $1
        AND user_id = $2
        AND valid_from <= timezone('utc', now())
        AND (valid_to IS NULL OR valid_to >= timezone('utc', now()))
      LIMIT 1
      FOR UPDATE;
    `,
    values: [projectId, userId],
  });

  if (membership.rowCount === 0) {
    throw new ForbiddenError({
      message: "Você não é membro deste projeto.",
      action: "Solicite acesso ao proprietário do projeto.",
    });
  }
}

async function assertManager(client, projectId, userId) {
  const projectResults = await client.query({
    text: `
      SELECT id, status
      FROM projects
      WHERE id = $1
      FOR UPDATE;
    `,
    values: [projectId],
  });

  if (projectResults.rowCount === 0) {
    throw new NotFoundError({
      message: "Projeto não encontrado.",
      action: "Verifique o ID do projeto informado.",
    });
  }

  const membership = await client.query({
    text: `
      SELECT role
      FROM project_members
      WHERE project_id = $1
        AND user_id = $2
        AND valid_from <= timezone('utc', now())
        AND (valid_to IS NULL OR valid_to >= timezone('utc', now()))
      LIMIT 1;
    `,
    values: [projectId, userId],
  });

  if (membership.rowCount === 0) {
    throw new ForbiddenError({
      message: "Você não é membro deste projeto.",
      action: "Solicite acesso ao proprietário do projeto.",
    });
  }

  if (!["owner", "admin"].includes(membership.rows[0].role)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para gerenciar o MCE.",
      action:
        "Apenas owner ou admin do projeto podem gerenciar versões do MCE.",
    });
  }

  return projectResults.rows[0];
}

async function listByProjectId(requestingUser, projectId) {
  await assertProjectMember(projectId, requestingUser.id);

  const results = await database.query({
    text: `
      SELECT *
      FROM mces
      WHERE project_id = $1
      ORDER BY version DESC;
    `,
    values: [projectId],
  });

  return results.rows;
}

async function createDraft(requestingUser, projectId) {
  return database.transaction(async (client) => {
    const projectFound = await assertManager(
      client,
      projectId,
      requestingUser.id,
    );

    if (projectFound.status === "archived") {
      throw new ConflictError({
        message: "Não é possível criar um MCE para um projeto arquivado.",
        action: "Reative o projeto antes de criar outra versão do MCE.",
      });
    }

    const draftResult = await client.query({
      text: `
        SELECT id
        FROM mces
        WHERE project_id = $1
          AND status = 'draft'
        LIMIT 1;
      `,
      values: [projectId],
    });

    if (draftResult.rowCount > 0) {
      throw new ConflictError({
        message: "Este projeto já possui um rascunho de MCE.",
        action:
          "Conclua ou arquive o rascunho atual antes de criar outra versão.",
      });
    }

    const versionResult = await client.query({
      text: `
        SELECT COALESCE(MAX(version), 0) + 1 AS next_version
        FROM mces
        WHERE project_id = $1;
      `,
      values: [projectId],
    });

    const results = await client.query({
      text: `
        INSERT INTO mces (project_id, version, created_by, updated_by)
        VALUES ($1, $2, $3, $3)
        RETURNING *;
      `,
      values: [
        projectId,
        versionResult.rows[0].next_version,
        requestingUser.id,
      ],
    });

    return results.rows[0];
  });
}

async function findOneById(requestingUser, projectId, mceId) {
  await assertProjectMember(projectId, requestingUser.id);

  const results = await database.query({
    text: `
      SELECT *
      FROM mces
      WHERE project_id = $1
        AND id = $2
      LIMIT 1;
    `,
    values: [projectId, mceId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Versão do MCE não encontrada.",
      action: "Verifique o ID do projeto e da versão informados.",
    });
  }

  return results.rows[0];
}

async function archiveDraft(requestingUser, projectId, mceId) {
  return database.transaction(async (client) => {
    await assertManager(client, projectId, requestingUser.id);

    const mceResult = await client.query({
      text: `
        SELECT *
        FROM mces
        WHERE project_id = $1
          AND id = $2
        FOR UPDATE;
      `,
      values: [projectId, mceId],
    });

    if (mceResult.rowCount === 0) {
      throw new NotFoundError({
        message: "Versão do MCE não encontrada.",
        action: "Verifique o ID do projeto e da versão informados.",
      });
    }

    if (mceResult.rows[0].status !== "draft") {
      throw new ConflictError({
        message: "Somente rascunhos podem ser arquivados.",
        action: "Esta versão do MCE já está arquivada.",
      });
    }

    const results = await client.query({
      text: `
        UPDATE mces
        SET status = 'archived',
            updated_by = $3,
            updated_at = timezone('utc', now())
        WHERE project_id = $1
          AND id = $2
        RETURNING *;
      `,
      values: [projectId, mceId, requestingUser.id],
    });

    return results.rows[0];
  });
}

const mce = {
  validateCreateInput,
  validateUpdateInput,
  listByProjectId,
  createDraft,
  findOneById,
  archiveDraft,
};

export default mce;

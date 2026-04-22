import database from "infra/database.js";
import { ValidationError, NotFoundError } from "infra/errors.js";

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

async function create(projectObject) {
  await validateUniqueName(projectObject.name);

  const createdProject = await runInsertQuery(projectObject);
  return createdProject;

  async function runInsertQuery(projectObject) {
    const results = await database.query({
      text: `
        INSERT INTO 
            projects (name, created_by) 
        VALUES 
            ($1, $2)
        RETURNING 
            *
        ;`,
      values: [projectObject.name, projectObject.created_by],
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

const project = {
  create,
  update,
  findOneById,
  validateUniqueName,
};

export default project;

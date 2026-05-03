import database from "infra/database.js";
import { ValidationError, NotFoundError } from "infra/errors.js";

async function findNaturalById(id) {
  const naturalPersonFound = await runSelectQuery(id);
  return naturalPersonFound;

  async function runSelectQuery(id) {
    const results = await database.query({
      text: `
      SELECT 
        * 
      FROM 
        natural_persons
      WHERE
        id = $1
      LIMIT
        1
      ;`,
      values: [id],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({
        name: "NotFoundError",
        message: "Pessoa física não encontrada.",
        action: "Verifique o ID da pessoa física informado.",
        status_code: 404,
      });
    }
    return results.rows[0];
  }
}

async function findLegalById(id) {
  const legalPersonFound = await runSelectQuery(id);
  return legalPersonFound;

  async function runSelectQuery(id) {
    const results = await database.query({
      text: `
      SELECT 
        * 
      FROM 
        legal_persons
      WHERE
        id = $1
      LIMIT
        1
      ;`,
      values: [id],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({
        name: "NotFoundError",
        message: "Pessoa jurídica não encontrada.",
        action: "Verifique o ID da pessoa jurídica informado.",
        status_code: 404,
      });
    }
    return results.rows[0];
  }
}

async function findOneByCPF(cpf) {
  const naturalPersonFound = await runSelectQuery(cpf);
  return naturalPersonFound;

  async function runSelectQuery(cpf) {
    const results = await database.query({
      text: `
      SELECT 
        * 
      FROM 
        natural_persons
      WHERE
        cpf = $1
      LIMIT
        1
      ;`,
      values: [cpf],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "Pessoa física não encontrada.",
        action: "Verifique o CPF informado.",
        status_code: 404,
      });
    }
    return results.rows[0];
  }
}

async function findOneByCNPJ(cnpj) {
  const legalPersonFound = await runSelectQuery(cnpj);
  return legalPersonFound;

  async function runSelectQuery(cnpj) {
    const results = await database.query({
      text: `
      SELECT 
        * 
      FROM 
        legal_persons
      WHERE
        cnpj = $1
      LIMIT
        1
      ;`,
      values: [cnpj],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "Pessoa jurídica não encontrada.",
        action: "Verifique o CNPJ informado.",
        status_code: 404,
      });
    }
    return results.rows[0];
  }
}

async function createNaturalPerson(userInputValues) {
  await validateUniqueCPF(userInputValues.cpf);

  const newNaturalPerson = await runInsertQuery(userInputValues);
  return newNaturalPerson;

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
    INSERT INTO 
      natural_persons (cpf, name, created_by) 
    VALUES 
      ($1, $2, $3)
    RETURNING 
      *
    ;`,
      values: [
        userInputValues.cpf,
        userInputValues.name,
        userInputValues.created_by,
      ],
    });
    return results.rows[0];
  }
}

async function createLegalPerson(userInputValues) {
  await validateUniqueCNPJ(userInputValues.cnpj);
  await validateUniqueLegalName(userInputValues.name);

  const newLegalPerson = await runInsertQuery(userInputValues);
  return newLegalPerson;

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
    INSERT INTO 
      legal_persons (cnpj, name, created_by) 
    VALUES 
      ($1, $2, $3)
    RETURNING 
      *
    ;`,
      values: [
        userInputValues.cnpj,
        userInputValues.name,
        userInputValues.created_by,
      ],
    });
    return results.rows[0];
  }
}

async function validateUniqueCPF(cpf) {
  const results = await database.query({
    text: `
      SELECT 
        cpf 
      FROM 
        natural_persons
      WHERE
        cpf = $1
      ;`,
    values: [cpf],
  });
  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "CPF já está em uso.",
      action: "Utilize outro CPF para realizar esta operação.",
    });
  }
}

async function validateUniqueCNPJ(cnpj) {
  const results = await database.query({
    text: `
      SELECT 
        cnpj 
      FROM 
        legal_persons
      WHERE
        cnpj = $1
      ;`,
    values: [cnpj],
  });
  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "CNPJ já está em uso.",
      action: "Utilize outro CNPJ para realizar esta operação.",
    });
  }
}

async function validateUniqueLegalName(name) {
  const results = await database.query({
    text: `
      SELECT 
        name 
      FROM 
        legal_persons
      WHERE
        name = $1
      ;`,
    values: [name],
  });
  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "Nome já está em uso.",
      action: "Utilize outro nome para realizar esta operação.",
    });
  }
}

async function updateNaturalPerson(personId, userInputValues) {
  const currentNaturalPerson = await findNaturalById(personId);

  if ("cpf" in userInputValues) {
    await validateUniqueCPF(userInputValues.cpf);
  }

  const naturalPersonWithNewValues = {
    ...currentNaturalPerson,
    ...userInputValues,
  };

  const updatedPerson = await runUpdateQuery(naturalPersonWithNewValues);
  return updatedPerson;

  async function runUpdateQuery(naturalPersonWithNewValues) {
    const results = await database.query({
      text: `
        UPDATE
          natural_persons
        SET
          cpf = $2,
          name = $3,
          updated_at = timezone('utc'::text, now())
        WHERE
          id = $1
        RETURNING
          *
        ;
        `,
      values: [
        naturalPersonWithNewValues.id,
        naturalPersonWithNewValues.cpf,
        naturalPersonWithNewValues.name,
      ],
    });
    return results.rows[0];
  }
}

async function updateLegalPerson(personId, userInputValues) {
  const currentLegalPerson = await findLegalById(personId);

  if ("name" in userInputValues) {
    await validateUniqueLegalName(userInputValues.name);
  }

  if ("cnpj" in userInputValues) {
    await validateUniqueCNPJ(userInputValues.cnpj);
  }

  const legalPersonWithNewValues = {
    ...currentLegalPerson,
    ...userInputValues,
  };

  const updatedPerson = await runUpdateQuery(legalPersonWithNewValues);
  return updatedPerson;

  async function runUpdateQuery(legalPersonWithNewValues) {
    const results = await database.query({
      text: `
        UPDATE
          legal_persons
        SET
          cnpj = $2,
          name = $3,
          updated_at = timezone('utc'::text, now())
        WHERE
          id = $1
        RETURNING
          *
        ;
        `,
      values: [
        legalPersonWithNewValues.id,
        legalPersonWithNewValues.cnpj,
        legalPersonWithNewValues.name,
      ],
    });
    return results.rows[0];
  }
}

async function validateUniqueLegalPersonMember(legalPersonId, naturalPersonId) {
  const results = await database.query({
    text: `
      SELECT id
      FROM legal_person_members
      WHERE legal_person_id = $1
        AND natural_person_id = $2
      LIMIT 1;
    `,
    values: [legalPersonId, naturalPersonId],
  });

  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "Pessoa já está vinculada a esta pessoa jurídica.",
      action:
        "Tente vincular outra pessoa física ou remova o vínculo existente.",
    });
  }
}

function validateMemberRole(role) {
  if (!role || typeof role !== "string" || role.length > 32) {
    throw new ValidationError({
      message: "Role inválida.",
      action: "Envie um texto (até 32 caracteres) em 'role'.",
    });
  }
}

async function listLegalPersonMembers(legalPersonId) {
  await findLegalById(legalPersonId);

  const results = await database.query({
    text: `
      SELECT *
      FROM legal_person_members
      WHERE legal_person_id = $1
        AND (valid_to IS NULL OR valid_to >= timezone('utc', now()))
      ORDER BY valid_from ASC;
    `,
    values: [legalPersonId],
  });

  return results.rows;
}

async function getLegalPersonMember(legalPersonId, naturalPersonId) {
  await findLegalById(legalPersonId);
  await findNaturalById(naturalPersonId);

  const results = await database.query({
    text: `
      SELECT *
      FROM legal_person_members
      WHERE legal_person_id = $1
        AND natural_person_id = $2
        AND (valid_to IS NULL OR valid_to >= timezone('utc', now()))
      LIMIT 1;
    `,
    values: [legalPersonId, naturalPersonId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      name: "NotFoundError",
      message: "Vínculo não encontrado.",
      action: "Verifique os IDs informados.",
      status_code: 404,
    });
  }

  return results.rows[0];
}

async function addLegalPersonMember({
  legal_person_id,
  natural_person_id,
  role,
}) {
  await findLegalById(legal_person_id);
  await findNaturalById(natural_person_id);
  validateMemberRole(role);
  await validateUniqueLegalPersonMember(legal_person_id, natural_person_id);

  const results = await database.query({
    text: `
      INSERT INTO legal_person_members (legal_person_id, natural_person_id, role)
      VALUES ($1, $2, $3)
      RETURNING *;
    `,
    values: [legal_person_id, natural_person_id, role],
  });

  return results.rows[0];
}

async function updateLegalPersonMember(
  legalPersonId,
  naturalPersonId,
  patchValues,
) {
  await findLegalById(legalPersonId);
  await findNaturalById(naturalPersonId);

  // garante que existe
  const current = await getLegalPersonMember(legalPersonId, naturalPersonId);

  const fields = [];
  const values = [legalPersonId, naturalPersonId];
  let idx = 3;

  if ("role" in patchValues) {
    validateMemberRole(patchValues.role);
    fields.push(`role = $${idx++}`);
    values.push(patchValues.role);
  }

  if ("valid_to" in patchValues) {
    const validTo = patchValues.valid_to;

    if (validTo !== null) {
      const parsed = Date.parse(validTo);
      if (Number.isNaN(parsed)) {
        throw new ValidationError({
          message: "valid_to inválido.",
          action: "Envie uma data ISO válida ou null.",
        });
      }

      const validFromParsed = Date.parse(current.valid_from);
      if (!Number.isNaN(validFromParsed) && parsed < validFromParsed) {
        throw new ValidationError({
          message: "valid_to não pode ser anterior a valid_from.",
          action: "Ajuste a data e tente novamente.",
        });
      }
    }

    fields.push(`valid_to = $${idx++}`);
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
      UPDATE legal_person_members
      SET ${fields.join(", ")}
      WHERE legal_person_id = $1 AND natural_person_id = $2
      RETURNING *;
    `,
    values,
  });

  return results.rows[0];
}

async function removeLegalPersonMember(legalPersonId, naturalPersonId) {
  await findLegalById(legalPersonId);
  await findNaturalById(naturalPersonId);

  const results = await database.query({
    text: `
      DELETE FROM legal_person_members
      WHERE legal_person_id = $1 AND natural_person_id = $2
      RETURNING *;
    `,
    values: [legalPersonId, naturalPersonId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      name: "NotFoundError",
      message: "Vínculo não encontrado.",
      action: "Verifique os IDs informados.",
      status_code: 404,
    });
  }

  return results.rows[0];
}

const person = {
  findLegalById,
  findNaturalById,
  findOneByCPF,
  findOneByCNPJ,
  createNaturalPerson,
  createLegalPerson,
  updateNaturalPerson,
  updateLegalPerson,

  // NEW: legal_person_members
  listLegalPersonMembers,
  getLegalPersonMember,
  addLegalPersonMember,
  updateLegalPersonMember,
  removeLegalPersonMember,
};

export default person;

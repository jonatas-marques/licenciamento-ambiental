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

const person = {
  findLegalById,
  findNaturalById,
  findOneByCPF,
  findOneByCNPJ,
  createNaturalPerson,
  createLegalPerson,
  updateNaturalPerson,
  updateLegalPerson,
};

export default person;

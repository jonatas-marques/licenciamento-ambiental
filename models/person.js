import database from "infra/database.js";
import { ValidationError, NotFoundError } from "infra/errors.js";

async function findOneById(id) {
  const personFound = await runSelectQuery(id);
  return personFound;

  async function runSelectQuery(id) {
    const results = await database.query({
      text: `
      SELECT 
        * 
      FROM 
        persons
      WHERE
        id = $1
      LIMIT
        1
      ;`,
      values: [id],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "Pessoa não encontrada.",
        action: "Verifique o ID da pessoa informado.",
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
  const person = await insertPerson(
    "pessoa física",
    //falta implementar endereço e telefone
    userInputValues.name,
    userInputValues.created_by,
  );
  const naturalPerson = await insertNaturalPerson(
    person.id,
    userInputValues.cpf,
    userInputValues.birth_date,
    userInputValues.mother_name,
  );
  return {
    ...person,
    ...naturalPerson,
  };
}

async function createLegalPerson(userInputValues) {
  const person = await insertPerson(
    "pessoa jurídica",
    userInputValues.name,
    userInputValues.created_by,
  );
  const legalPerson = await insertLegalPerson(person.id, userInputValues.cnpj);
  return {
    ...person,
    ...legalPerson,
  };
}

async function insertPerson(type, name, createdBy) {
  const results = await database.query({
    text: `
      INSERT INTO 
        persons (type, name, created_by) 
      VALUES 
        ($1, $2, $3)
      RETURNING 
        *
      ;`,
    values: [type, name, createdBy],
  });
  return results.rows[0];
}

async function insertNaturalPerson(personId, cpf, birthDate, motherName) {
  await validateUniqueCpf(cpf);
  const results = await database.query({
    text: `
    INSERT INTO 
      natural_persons (id, cpf, birth_date, mother_name) 
    VALUES 
      ($1, $2, $3, $4)
    RETURNING 
      *
    ;`,
    values: [personId, cpf, birthDate, motherName],
  });
  return results.rows[0];
}

async function insertLegalPerson(personId, cnpj) {
  await validateUniqueCnpj(cnpj);
  const results = await database.query({
    text: `
    INSERT INTO 
      legal_persons (id, cnpj) 
    VALUES 
      ($1, $2)
    RETURNING 
      *
    ;`,
    values: [personId, cnpj],
  });
  return results.rows[0];
}

async function validateUniqueCpf(cpf) {
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

async function validateUniqueCnpj(cnpj) {
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

const person = {
  createNaturalPerson,
  createLegalPerson,
  findOneById,
  findOneByCPF,
  findOneByCNPJ,
};

export default person;

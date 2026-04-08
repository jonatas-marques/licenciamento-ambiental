import database from "infra/database.js";
import { ValidationError, NotFoundError } from "infra/errors.js";

async function findOneById(id) {
  const pessoaFound = await runSelectQuery(id);
  return pessoaFound;

  async function runSelectQuery(id) {
    const results = await database.query({
      text: `
      SELECT 
        * 
      FROM 
        pessoas
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
  const pessoaFisicaFound = await runSelectQuery(cpf);
  return pessoaFisicaFound;

  async function runSelectQuery(cpf) {
    const results = await database.query({
      text: `
      SELECT 
        * 
      FROM 
        pessoa_fisica
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
  const pessoaJuridicaFound = await runSelectQuery(cnpj);
  return pessoaJuridicaFound;

  async function runSelectQuery(cnpj) {
    const results = await database.query({
      text: `
      SELECT 
        * 
      FROM 
        pessoa_juridica
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

async function createPessoaFisica(userInputValues) {
  console.log(
    "Criando pessoa física com os seguintes valores de entrada:",
    userInputValues,
  );
  const pessoaBase = await insertPessoaBase(
    "pessoa física",
    //falta implementar endereço e telefone
    userInputValues.nome,
    userInputValues.criado_por,
  );
  const pessoaFisica = await insertPessoaFisica(
    pessoaBase.id,
    userInputValues.cpf,
    userInputValues.data_nascimento,
    userInputValues.nome_mae,
  );
  return {
    ...pessoaBase,
    ...pessoaFisica,
  };
}

async function createPessoaJuridica(userInputValues) {
  const pessoaBase = await insertPessoaBase(
    "pessoa jurídica",
    userInputValues.nome,
    userInputValues.criado_por,
  );
  const pessoaJuridica = await insertPessoaJuridica(
    pessoaBase.id,
    userInputValues.cnpj,
  );
  return {
    ...pessoaBase,
    ...pessoaJuridica,
  };
}

async function insertPessoaBase(tipo, nome, criadoPor) {
  const results = await database.query({
    text: `
      INSERT INTO 
        pessoas (tipo, nome, criado_por) 
      VALUES 
        ($1, $2, $3)
      RETURNING 
        *
      ;`,
    values: [tipo, nome, criadoPor],
  });
  return results.rows[0];
}

async function insertPessoaFisica(pessoaId, cpf, dataNascimento, nomeMae) {
  await validateUniqueCpf(cpf);
  const results = await database.query({
    text: `
    INSERT INTO 
      pessoa_fisica (id, cpf, data_nascimento, nome_mae) 
    VALUES 
      ($1, $2, $3, $4)
    RETURNING 
      *
    ;`,
    values: [pessoaId, cpf, dataNascimento, nomeMae],
  });
  return results.rows[0];
}

async function insertPessoaJuridica(pessoaId, cnpj) {
  await validateUniqueCnpj(cnpj);
  const results = await database.query({
    text: `
    INSERT INTO 
      pessoa_juridica (id, cnpj) 
    VALUES 
      ($1, $2)
    RETURNING 
      *
    ;`,
    values: [pessoaId, cnpj],
  });
  return results.rows[0];
}

async function validateUniqueCpf(cpf) {
  const results = await database.query({
    text: `
      SELECT 
        cpf 
      FROM 
        pessoa_fisica
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
        pessoa_juridica
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

const pessoa = {
  createPessoaFisica,
  createPessoaJuridica,
  findOneById,
  findOneByCPF,
  findOneByCNPJ,
};

export default pessoa;

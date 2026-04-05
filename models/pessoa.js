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

async function create(userImputValues) {
  if (userImputValues.tipo === "pessoa física") {
    return await createPessoaFisica({
      nome: userImputValues.nome,
      cpf: userImputValues.cpf,
      criado_por: userImputValues.criado_por,
    });
  } else if (userImputValues.tipo === "pessoa jurídica") {
    return await createPessoaJuridica({
      nome: userImputValues.nome,
      cnpj: userImputValues.cnpj,
      criado_por: userImputValues.criado_por,
    });
  }
}

async function createPessoaFisica({ nome, cpf, criado_por }) {
  const novaPessoa = await createPessoaBase("pessoa física", nome, criado_por);
  const novaPessoaFisica = await insertPessoaFisica(novaPessoa.id, cpf);
  return { novaPessoa, novaPessoaFisica, novaPessoaJuridica: null };
}

async function createPessoaJuridica({ nome, cnpj, criado_por }) {
  const novaPessoa = await createPessoaBase("pessoa jurídica", nome, criado_por);
  const novaPessoaJuridica = await insertPessoaJuridica(novaPessoa.id, cnpj);
  return { novaPessoa, novaPessoaFisica: null, novaPessoaJuridica };
}

async function createPessoaBase(tipo, nome, criado_por) {
  const results = await database.query({
    text: `
      INSERT INTO 
        pessoas (tipo, nome, criado_por) 
      VALUES 
        ($1, $2, $3)
      RETURNING 
        *
      ;`,
    values: [tipo, nome, criado_por],
  });
  return results.rows[0];
}

async function insertPessoaFisica(pessoaId, cpf) {
  await validateUniqueCpf(cpf);
  const results = await database.query({
    text: `
    INSERT INTO 
      pessoa_fisica (id, cpf) 
    VALUES 
      ($1, $2)
    RETURNING 
      *
    ;`,
    values: [pessoaId, cpf],
  });
  return results.rows[0];
}

async function insertPessoaJuridica(pessoaId, cnpj) {
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

const pessoa = {
  create,
  createPessoaFisica,
  createPessoaJuridica,
  findOneById,
  findOneByCPF,
  findOneByCNPJ,
};

export default pessoa;

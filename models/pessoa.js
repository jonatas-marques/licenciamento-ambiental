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
  const novaPessoa = await runInsertQuery(userImputValues);

  let novaPessoaFisica = null;
  let novaPessoaJuridica = null;

  if (userImputValues.tipo === "pessoa física") {
    novaPessoaFisica = await createPessoaFisica(
      novaPessoa.id,
      userImputValues.cpf,
    );
  } else if (userImputValues.tipo === "pessoa jurídica") {
    novaPessoaJuridica = await createPessoaJuridica(
      novaPessoa.id,
      userImputValues.cnpj,
    );
  }

  return { novaPessoa, novaPessoaFisica, novaPessoaJuridica };

  async function runInsertQuery(userImputValues) {
    const results = await database.query({
      text: `
      INSERT INTO 
        pessoas (tipo, nome, criado_por) 
      VALUES 
        ($1, $2, $3)
      RETURNING 
        *
      ;`,
      values: [
        userImputValues.tipo,
        userImputValues.nome,
        userImputValues.criado_por,
      ],
    });

    return results.rows[0];
  }
}

async function createPessoaFisica(pessoaId, cpf) {
  await validateUniqueCpf(cpf);
  const pessoaFisica = await runInsertQuery(pessoaId, cpf);
  return pessoaFisica;

  async function runInsertQuery(pessoaId, cpf) {
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
}

async function createPessoaJuridica(pessoaId, cnpj) {
  const pessoaJuridica = await runInsertQuery(pessoaId, cnpj);
  return pessoaJuridica;

  async function runInsertQuery(pessoaId, cnpj) {
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
  findOneById,
  findOneByCPF,
  findOneByCNPJ,
};

export default pessoa;

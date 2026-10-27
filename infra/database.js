import { Client } from "pg";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceError,
  UnauthorizedError,
  ValidationError,
} from "./errors.js";

const domainErrors = [
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
];

async function query(queryObjetc) {
  let client;

  try {
    client = await getNewClient();
    const result = await client.query(queryObjetc);
    return result;
  } catch (error) {
    const serviceErrorObject = new ServiceError({
      message: "Erro na conexão com Banco ou na Query.",
      cause: error,
    });
    throw serviceErrorObject;
  } finally {
    await client?.end();
  }
}

async function transaction(callback) {
  let client;

  try {
    client = await getNewClient();
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        throw new ServiceError({
          message: "Não foi possível reverter a transação do banco de dados.",
          cause: new AggregateError([error, rollbackError]),
        });
      }
    }

    if (
      error instanceof ServiceError ||
      domainErrors.some((ErrorType) => error instanceof ErrorType)
    ) {
      throw error;
    }

    throw new ServiceError({
      message: "Erro na transação do banco de dados.",
      cause: error,
    });
  } finally {
    await client?.end();
  }
}

async function getNewClient() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    ssl: getSSLValues(),
  });

  await client.connect();
  return client;
}

const database = {
  query,
  transaction,
  getNewClient,
};

export default database;

function getSSLValues() {
  if (process.env.POSTGRES_CA) {
    return {
      ca: process.env.POSTGRES_CA,
    };
  }

  return process.env.NODE_ENV === "production" ? true : false;
}

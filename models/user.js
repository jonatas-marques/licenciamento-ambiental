import database from "infra/database.js";
import { ValidationError, NotFoundError } from "infra/errors.js";
import password from "models/password.js";

async function findOneById(id) {
  const userFound = await runSelectQuery(id);
  return userFound;

  async function runSelectQuery(id) {
    const results = await database.query({
      text: `
      SELECT 
        * 
      FROM 
        users
      WHERE
        id = $1
      LIMIT
        1
      ;`,
      values: [id],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "ID não encontrado.",
        action: "Verifique o ID do usuário informado.",
        status_code: 404,
      });
    }

    return results.rows[0];
  }
}
async function findOneByUsername(username) {
  const userFound = await runSelectQuery(username);
  return userFound;

  async function runSelectQuery(username) {
    const results = await database.query({
      text: `
      SELECT 
        * 
      FROM 
        users
      WHERE
        LOWER(username) = LOWER($1)
      LIMIT
        1
      ;`,
      values: [username],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "Usuário não encontrado.",
        action: "Verifique o nome de usuário informado.",
        status_code: 404,
      });
    }

    return results.rows[0];
  }
}
async function findOneByEmail(email) {
  const userFound = await runSelectQuery(email);
  return userFound;

  async function runSelectQuery(email) {
    const results = await database.query({
      text: `
      SELECT 
        * 
      FROM 
        users
      WHERE
        LOWER(email) = LOWER($1)
      LIMIT
        1
      ;`,
      values: [email],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "E-mail não encontrado.",
        action: "Verifique o e-mail informado.",
        status_code: 404,
      });
    }

    return results.rows[0];
  }
}

async function create(userImputValues) {
  await validateUniqueUsername(userImputValues.username);
  await validateUniqueEmail(userImputValues.email);
  await hashPasswordInObject(userImputValues);
  injectDefaultFeaturesInObject(userImputValues);

  const newUser = await runInsertQuery(userImputValues);
  return newUser;

  async function runInsertQuery(userImputValues) {
    const results = await database.query({
      text: `
      INSERT INTO 
        users (username, email, password, features) 
      VALUES 
        ($1, $2, $3, $4)
      RETURNING 
        *
      ;`,
      values: [
        userImputValues.username,
        userImputValues.email,
        userImputValues.password,
        userImputValues.features,
      ],
    });
    return results.rows[0];
  }

  function injectDefaultFeaturesInObject(userImputValues) {
    userImputValues.features = ["read:activation_token"];
  }
}

async function update(username, userInputValues) {
  const currentUser = await findOneByUsername(username);

  if ("username" in userInputValues) {
    await validateUniqueUsername(userInputValues.username);
  }

  if ("email" in userInputValues) {
    await validateUniqueEmail(userInputValues.email);
  }

  if ("password" in userInputValues) {
    await hashPasswordInObject(userInputValues);
  }

  const userWithNewValues = { ...currentUser, ...userInputValues };

  const updatedUser = await runUpdateQuery(userWithNewValues);
  return updatedUser;

  async function runUpdateQuery(userWithNewValues) {
    const results = await database.query({
      text: `
      uPDATE
        users
      SET
        username = $2,
        email = $3,
        password = $4,
        updated_at = timezone('utc'::text, now())
      WHERE
        id = $1
      RETURNING
        *
      ;
      `,
      values: [
        userWithNewValues.id,
        userWithNewValues.username,
        userWithNewValues.email,
        userWithNewValues.password,
      ],
    });
    return results.rows[0];
  }
}

async function validateUniqueUsername(username) {
  const results = await database.query({
    text: `
      SELECT 
        username 
      FROM 
        users
      WHERE
        LOWER(username) = LOWER($1)
      ;`,
    values: [username],
  });
  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "Nome de usuário já está em uso.",
      action: "Utilize outro nome de usuário para realizar esta operação.",
    });
  }
}

async function validateUniqueEmail(email) {
  const results = await database.query({
    text: `
      SELECT 
        email 
      FROM 
        users
      WHERE
        LOWER(email) = LOWER($1)
      ;`,
    values: [email],
  });
  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "Email informado já está em uso.",
      action: "Utilize outro email para realizar esta operação.",
    });
  }
}

async function hashPasswordInObject(userImputValues) {
  const hashedPassword = await password.hash(userImputValues.password);
  userImputValues.password = hashedPassword;
}

async function setFeatures(userId, features) {
  const updatedUser = await runUpdateQuery(userId, features);
  return updatedUser;

  async function runUpdateQuery(userId, features) {
    const results = await database.query({
      text: `
      UPDATE
        users
      SET
        features = $2,
        updated_at = timezone('utc'::text, now())
      WHERE
        id = $1
      RETURNING
        *
      ;
      `,
      values: [userId, features],
    });
    return results.rows[0];
  }
}
async function addFeatures(userId, features) {
  const updatedUser = await runUpdateQuery(userId, features);
  return updatedUser;

  async function runUpdateQuery(userId, features) {
    const results = await database.query({
      text: `
      UPDATE
        users
      SET
        features = array_cat(features, $2),
        updated_at = timezone('utc'::text, now())
      WHERE
        id = $1
      RETURNING
        *
      ;
      `,
      values: [userId, features],
    });
    return results.rows[0];
  }
}

const user = {
  create,
  findOneById,
  findOneByUsername,
  findOneByEmail,
  update,
  setFeatures,
  addFeatures,
};
export default user;

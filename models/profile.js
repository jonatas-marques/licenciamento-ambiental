import database from "infra/database.js";
import { NotFoundError, ConflictError } from "infra/errors.js";
import user from "models/user.js";
import person from "models/person.js";

// Find the profile by user ID
async function findOneByUser(userObject) {
  const userFound = await user.findOneById(userObject.id);

  let personFound = null;

  try {
    personFound = await person.findOneByUserId(userObject.id);
  } catch (error) {
    if (!(error instanceof NotFoundError)) {
      throw error;
    }
  }

  if (!personFound) {
    try {
      personFound = await person.findOneByCpf(userObject.cpf);
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }
  }

  // Check if CPF of user and person match, return 409
  if (personFound && userObject.cpf !== personFound.cpf) {
    throw new ConflictError({
      message: "CPF do usuário e da pessoa física não correspondem.",
      action: "Verifique o CPF informado.",
      status_code: 409,
    });
  }

  // Return a object with user and person data
  const profileFound = {
    user: userFound,
    person: personFound,
  };

  return profileFound;
}

// Update the profile by user ID
async function update(userId, userInputValues) {
  const profileFound = await findOneByUserId(userId);

  await updateQuery(profileFound, userInputValues);

  async function updateQuery(profileFound, userInputValues) {
    //query to update user and person data
    const query = `
      UPDATE users u
      SET 
        u.name = COALESCE($1, u.name),
        u.email = COALESCE($2, u.email),
        u.cpf = COALESCE($3, u.cpf)
      WHERE u.id = $4
      RETURNING *;
    `;

    const values = [
      userInputValues.name,
      userInputValues.email,
      userInputValues.cpf,
      profileFound.user.id,
    ];

    const result = await database.query(query, values);

    if (result.rowCount === 0) {
      throw new NotFoundError({
        message: "Usuário não encontrado.",
        action: "Verifique o ID do usuário informado.",
        status_code: 404,
      });
    }

    return result.rows[0];
  }
}

const profile = {
  findOneByUser,
  update,
};

export default profile;

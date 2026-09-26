import user from "models/user.js";
import password from "models/password";
import { UnauthorizedError, NotFoundError } from "infra/errors.js";

async function getUser(providedCpf, providedPassword) {
  try {
    const storedUser = await findUserByCpf(providedCpf);
    await validatePassword(providedPassword, storedUser.password);

    return storedUser;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw new UnauthorizedError({
        message: "Dados de autenticação não conferem.",
        action: "Verifique se os dados enviados estão corretos.",
      });
    }
    throw error;
  }

  async function findUserByCpf(providedCpf) {
    let storedUser;

    try {
      storedUser = await user.findOnebyCpf(providedCpf);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new UnauthorizedError({
          message: "CPF não confere.",
          action: "Verifique se este dado está correto.",
        });
      }

      throw error;
    }

    return storedUser;
  }
  async function validatePassword(providedPassword, storedPassword) {
    const correctPasswordMatch = await password.compare(
      providedPassword,
      storedPassword,
    );
    if (!correctPasswordMatch) {
      throw new UnauthorizedError({
        message: "Senha não confere.",
        action: "Verifique se este dado está correto.",
      });
    }
  }
}
const authentication = {
  getUser,
};

export default authentication;

import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import project from "models/project.js";
import authorization from "models/authorization.js";
import user from "models/user.js";
import { ValidationError } from "infra/errors.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .post(controller.canRequest("create:project"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const projectId = request.query.id;

  const members = await project.listMembers(userTryingToGet, projectId);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:project",
    members,
  );

  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const userInputValues = request.body;

  const memberUser = await findMemberUser(
    userInputValues.user_identifier ?? userInputValues.user_id,
  );
  const newMember = await project.addMember(userTryingToPost, {
    ...userInputValues,
    project_id: request.query.id,
    user_id: memberUser.id,
  });

  const secureOutputValues = authorization.filterOutput(
    userTryingToPost,
    "read:project",
    newMember,
  );
  return response.status(201).json(secureOutputValues);
}

async function findMemberUser(userIdentifier) {
  if (typeof userIdentifier !== "string" || userIdentifier.trim() === "") {
    throw new ValidationError({
      message: "Identificador do usuário não informado.",
      action: "Informe o UUID, e-mail ou CPF da conta que deseja adicionar.",
    });
  }

  const identifier = userIdentifier.trim();
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (uuidPattern.test(identifier)) {
    return user.findOneById(identifier);
  }

  if (identifier.includes("@")) {
    return user.findOneByEmail(identifier);
  }

  const cpf = identifier.replace(/\D/g, "");
  if (/^\d{11}$/.test(cpf)) {
    return user.findOneByCpf(cpf);
  }

  throw new ValidationError({
    message: "Identificador do usuário inválido.",
    action: "Informe um UUID válido, um e-mail ou um CPF com 11 dígitos.",
  });
}

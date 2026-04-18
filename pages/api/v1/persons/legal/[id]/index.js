import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import person from "models/person.js";
import authorization from "models/authorization.js";
import { ForbiddenError } from "infra/errors.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(getHandler)
  .patch(controller.canRequest("update:person"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const personId = request.query.id;
  const personFound = await person.findOneById(personId);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:person",
    personFound,
  );

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const userInputValues = request.body;

  const personId = request.query.id;
  const targetPerson = await person.findOneById(personId);

  if (!authorization.can(userTryingToPatch, "update:person", targetPerson)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar essa pessoa.",
      action:
        "Verifique se você possui a feature necessária para atualizar essa pessoa.",
    });
  }

  const updatedPerson = await person.update(personId, userInputValues);

  const secureOutputValues = authorization.filterOutput(
    userTryingToPatch,
    "update:person",
    updatedPerson,
  );

  return response.status(200).json(secureOutputValues);
}

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
  const naturalPersonId = request.query.id;
  const naturalPersonFound = await person.findNaturalById(naturalPersonId);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:person",
    naturalPersonFound,
  );

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const userInputValues = request.body;

  const naturalPersonId = request.query.id;
  const targetNaturalPerson = await person.findNaturalById(naturalPersonId);

  if (
    !authorization.can(userTryingToPatch, "update:person", targetNaturalPerson)
  ) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar essa pessoa.",
      action:
        "Verifique se você possui a feature necessária para atualizar essa pessoa.",
    });
  }

  const updatedNaturalPerson =
    await person.updateNaturalPerson(userInputValues);

  const secureOutputValues = authorization.filterOutput(
    userTryingToPatch,
    "update:person",
    updatedNaturalPerson,
  );

  return response.status(200).json(secureOutputValues);
}

import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import person from "models/person.js";
import authorization from "models/authorization.js";
import { ForbiddenError } from "infra/errors.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(getHandler)
  .patch(controller.canRequest("update:person"), patchHandler)
  .delete(controller.canRequest("update:person"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const legalPersonId = request.query.id;
  const naturalPersonId = request.query.natural_person_id;

  const membership = await person.getLegalPersonMember(
    legalPersonId,
    naturalPersonId,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:person",
    membership,
  );

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const legalPersonId = request.query.id;
  const naturalPersonId = request.query.natural_person_id;

  const targetLegalPerson = await person.findLegalById(legalPersonId);
  if (
    !authorization.can(userTryingToPatch, "update:person", targetLegalPerson)
  ) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar essa pessoa.",
      action:
        "Verifique se você possui a feature necessária para atualizar essa pessoa.",
    });
  }

  const patchValues = request.body;

  const updatedMembership = await person.updateLegalPersonMember(
    legalPersonId,
    naturalPersonId,
    patchValues,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToPatch,
    "read:person",
    updatedMembership,
  );

  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const legalPersonId = request.query.id;
  const naturalPersonId = request.query.natural_person_id;

  const targetLegalPerson = await person.findLegalById(legalPersonId);
  if (
    !authorization.can(userTryingToDelete, "update:person", targetLegalPerson)
  ) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar essa pessoa.",
      action:
        "Verifique se você possui a feature necessária para atualizar essa pessoa.",
    });
  }

  const deletedMembership = await person.removeLegalPersonMember(
    legalPersonId,
    naturalPersonId,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToDelete,
    "read:person",
    deletedMembership,
  );

  return response.status(200).json(secureOutputValues);
}

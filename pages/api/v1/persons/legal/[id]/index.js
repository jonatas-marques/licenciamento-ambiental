import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import person from "models/person.js";
import authorization from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(getHandler)
  .patch(controller.canRequest("update:person"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const legalPersonId = request.query.id;
  const legalPersonFound = await person.findLegalById(legalPersonId);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:project",
    legalPersonFound,
  );

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const userInputValues = request.body;

  const legalPersonId = request.query.id;
  const targetLegalPerson = await person.findLegalById(legalPersonId);

  if (
    !authorization.can(userTryingToPatch, "update:person", targetLegalPerson)
  ) {
    await person.ensureRequesterIsLegalPersonMember(
      legalPersonId,
      userTryingToPatch,
    );
  }

  const updatedLegalPerson = await person.updateLegalPerson(
    legalPersonId,
    userInputValues,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToPatch,
    "read:project",
    updatedLegalPerson,
  );

  return response.status(200).json(secureOutputValues);
}

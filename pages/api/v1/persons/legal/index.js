import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import person from "models/person.js";
import authorization from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .post(controller.canRequest("create:person"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  response.setHeader(
    "Cache-Control",
    "no-store, no-cache, max-age=0, must-revalidate",
  );

  const legalPersons = await person.listLegalPersonsByUser(userTryingToGet);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:project",
    legalPersons,
  );

  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const userInputValues = {
    ...request.body,
    created_by: userTryingToPost.id, // Vem do servidor, não do Cliente!
  };
  const newLegalPerson = await person.createLegalPersonForUser(
    userInputValues,
    userTryingToPost,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToPost,
    "read:person",
    newLegalPerson,
  );

  return response.status(201).json(secureOutputValues);
}

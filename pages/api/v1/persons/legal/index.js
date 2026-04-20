import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import person from "models/person.js";
import authorization from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:person"), postHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const userInputValues = {
    ...request.body,
    created_by: userTryingToPost.id, // Vem do servidor, não do Cliente!
  };
  const newLegalPerson = await person.createLegalPerson(userInputValues);

  const secureOutputValues = authorization.filterOutput(
    userTryingToPost,
    "create:person",
    newLegalPerson,
  );

  return response.status(201).json(secureOutputValues);
}

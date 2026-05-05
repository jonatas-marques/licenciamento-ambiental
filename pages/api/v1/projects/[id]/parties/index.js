import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorization from "models/authorization.js";
import party from "models/party.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .post(controller.canRequest("create:project"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const projectId = request.query.id;

  const parties = await party.listParties(userTryingToGet, projectId);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:project",
    parties,
  );

  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const projectId = request.query.id;

  const createdParty = await party.addParty(
    userTryingToPost,
    projectId,
    request.body,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToPost,
    "read:project",
    createdParty,
  );

  return response.status(201).json(secureOutputValues);
}

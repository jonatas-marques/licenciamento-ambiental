import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorization from "models/authorization.js";
import party from "models/party.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .patch(controller.canRequest("update:project"), patchHandler)
  .delete(controller.canRequest("update:project"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const projectId = request.query.id;
  const partyId = request.query.party_id;

  const found = await party.getParty(userTryingToGet, projectId, partyId);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:project",
    found,
  );

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const projectId = request.query.id;
  const partyId = request.query.party_id;

  const updated = await party.updateParty(
    userTryingToPatch,
    projectId,
    partyId,
    request.body,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToPatch,
    "read:project",
    updated,
  );

  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const projectId = request.query.id;
  const partyId = request.query.party_id;

  const deleted = await party.removeParty(
    userTryingToDelete,
    projectId,
    partyId,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToDelete,
    "read:project",
    deleted,
  );

  return response.status(200).json(secureOutputValues);
}

import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import project from "models/project.js";
import authorization from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .patch(controller.canRequest("update:project"), patchHandler)
  .delete(controller.canRequest("update:project"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const projectId = request.query.id;
  const userId = request.query.user_id;

  const membership = await project.getMember(
    userTryingToGet,
    projectId,
    userId,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:project",
    membership,
  );

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const projectId = request.query.id;
  const userId = request.query.user_id;
  const patchValues = request.body;

  const updatedMembership = await project.updateMember(
    userTryingToPatch,
    projectId,
    userId,
    patchValues,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToPatch,
    "read:project",
    updatedMembership,
  );

  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const projectId = request.query.id;
  const userId = request.query.user_id;

  const deletedMembership = await project.removeMember(
    userTryingToDelete,
    projectId,
    userId,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToDelete,
    "read:project",
    deletedMembership,
  );

  return response.status(200).json(secureOutputValues);
}

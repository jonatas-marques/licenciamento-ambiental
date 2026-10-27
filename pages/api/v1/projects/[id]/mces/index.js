import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorization from "models/authorization.js";
import mce from "models/mce.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .post(controller.canRequest("create:project"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const requestingUser = request.context.user;
  const projectId = request.query.id;
  const versions = await mce.listByProjectId(requestingUser, projectId);

  const secureOutputValues = authorization.filterOutput(
    requestingUser,
    "read:project",
    versions,
  );

  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const requestingUser = request.context.user;
  mce.validateCreateInput(request.body);

  const createdMce = await mce.createDraft(requestingUser, request.query.id);

  const secureOutputValues = authorization.filterOutput(
    requestingUser,
    "read:project",
    createdMce,
  );

  return response.status(201).json(secureOutputValues);
}

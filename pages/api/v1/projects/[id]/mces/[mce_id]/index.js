import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorization from "models/authorization.js";
import mce from "models/mce.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .patch(controller.canRequest("update:project"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const requestingUser = request.context.user;
  const foundMce = await mce.findOneById(
    requestingUser,
    request.query.id,
    request.query.mce_id,
  );

  const secureOutputValues = authorization.filterOutput(
    requestingUser,
    "read:project",
    foundMce,
  );

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const requestingUser = request.context.user;
  mce.validateUpdateInput(request.body);

  const archivedMce = await mce.archiveDraft(
    requestingUser,
    request.query.id,
    request.query.mce_id,
  );

  const secureOutputValues = authorization.filterOutput(
    requestingUser,
    "read:project",
    archivedMce,
  );

  return response.status(200).json(secureOutputValues);
}

import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorization from "models/authorization.js";
import mce from "models/mce.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .post(controller.canRequest("update:project"), postHandler)
  .patch(controller.canRequest("update:project"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const user = request.context.user;
  const found = await mce.getMce(user, request.query.id);

  return response
    .status(200)
    .json(authorization.filterOutput(user, "read:project", found));
}

async function postHandler(request, response) {
  const user = request.context.user;
  const created = await mce.createMce(user, request.query.id);

  return response
    .status(201)
    .json(authorization.filterOutput(user, "read:project", created));
}

async function patchHandler(request, response) {
  const user = request.context.user;
  const updated = await mce.updateMce(user, request.query.id, request.body);

  return response
    .status(200)
    .json(authorization.filterOutput(user, "read:project", updated));
}

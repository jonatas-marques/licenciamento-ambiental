import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorization from "models/authorization.js";
import mce from "models/mce.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .patch(controller.canRequest("update:project"), patchHandler)
  .delete(controller.canRequest("update:project"), deleteHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const user = request.context.user;
  const { collection, id, item_id } = request.query;
  const found = await mce.getItem(collection, user, id, item_id);

  return response
    .status(200)
    .json(authorization.filterOutput(user, "read:project", found));
}

async function patchHandler(request, response) {
  const user = request.context.user;
  const { collection, id, item_id } = request.query;
  const updated = await mce.updateItem(
    collection,
    user,
    id,
    item_id,
    request.body,
  );

  return response
    .status(200)
    .json(authorization.filterOutput(user, "read:project", updated));
}

async function deleteHandler(request, response) {
  const user = request.context.user;
  const { collection, id, item_id } = request.query;
  const deleted = await mce.removeItem(collection, user, id, item_id);

  return response
    .status(200)
    .json(authorization.filterOutput(user, "read:project", deleted));
}

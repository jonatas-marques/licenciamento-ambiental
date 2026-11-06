import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorization from "models/authorization.js";
import mce from "models/mce.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .post(controller.canRequest("update:project"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const user = request.context.user;
  const items = await mce.listItems(
    request.query.collection,
    user,
    request.query.id,
  );

  return response
    .status(200)
    .json(authorization.filterOutput(user, "read:project", items));
}

async function postHandler(request, response) {
  const user = request.context.user;
  const created = await mce.createItem(
    request.query.collection,
    user,
    request.query.id,
    request.body,
  );

  return response
    .status(201)
    .json(authorization.filterOutput(user, "read:project", created));
}

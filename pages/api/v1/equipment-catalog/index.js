import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorization from "models/authorization.js";
import mce from "models/mce.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const user = request.context.user;
  const catalog = await mce.searchEquipmentCatalog(request.query.q);

  return response
    .status(200)
    .json(authorization.filterOutput(user, "read:project", catalog));
}

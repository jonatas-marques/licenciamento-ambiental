import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorization from "models/authorization.js";
import profile from "models/profile.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:profile"), getHandler)
  .patch(controller.canRequest("update:profile"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;

  const profileFound = await profile.findOneByUser(userTryingToGet);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:profile",
    profileFound,
  );

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToUpdate = request.context.user;

  const profileFound = await profile.findOneByUser(userTryingToUpdate);

  const secureOutputValues = authorization.filterOutput(
    userTryingToUpdate,
    "update:profile",
    profileFound,
  );

  return response.status(200).json(secureOutputValues);
}

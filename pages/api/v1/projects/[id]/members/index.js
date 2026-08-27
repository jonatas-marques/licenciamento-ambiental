import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import project from "models/project.js";
import authorization from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .post(controller.canRequest("create:project"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const projectId = request.query.id;

  const members = await project.listMembers(userTryingToGet, projectId);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:project",
    members,
  );

  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const userInputValues = request.body;

  const newMember = await project.addMember(userTryingToPost, userInputValues);

  const secureOutputValues = authorization.filterOutput(
    userTryingToPost,
    "read:project",
    newMember,
  );
  return response.status(201).json(secureOutputValues);
}

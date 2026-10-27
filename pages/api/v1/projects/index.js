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
  response.setHeader(
    "Cache-Control",
    "no-store, no-cache, max-age=0, must-revalidate",
  );

  const projects = await project.listByUserId(userTryingToGet.id);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:project",
    projects,
  );

  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const userInputValues = request.body;
  project.validateCreateInput(userInputValues);

  const newProject = await project.create({
    name: userInputValues.name,
    created_by: userTryingToPost.id,
  });

  const secureOutputValues = authorization.filterOutput(
    userTryingToPost,
    "read:project",
    newProject,
  );

  return response.status(201).json(secureOutputValues);
}

import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import project from "models/project.js";
import authorization from "models/authorization.js";
import { ForbiddenError } from "infra/errors.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .patch(controller.canRequest("update:project"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const projectId = request.query.id;
  const projectFound = await project.findOneById(projectId);

  response.setHeader(
    "Cache-Control",
    "no-store, no-cache, max-age=0, must-revalidate",
  );

  await project.ensureRequesterIsMemberOrThrowForbidden(
    projectId,
    userTryingToGet,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:project",
    projectFound,
  );

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const userInputValues = request.body;

  const projectId = request.query.id;
  const targetProject = await project.findOneById(projectId);

  if (!authorization.can(userTryingToPatch, "update:project", targetProject)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar esse projeto.",
      action:
        "Verifique se você possui a feature necessária para atualizar esse projeto.",
    });
  }

  await project.ensureCanUpdateProject(projectId, userTryingToPatch);
  project.validateUpdateInput(userInputValues);

  const updatedProject = await project.update(
    projectId,
    userInputValues,
    userTryingToPatch.id,
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToPatch,
    "read:project",
    updatedProject,
  );

  return response.status(200).json(secureOutputValues);
}

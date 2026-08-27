import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import person from "models/person.js";
import authorization from "models/authorization.js";
import { ForbiddenError } from "infra/errors.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(getHandler)
  .post(controller.canRequest("update:person"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const legalPersonId = request.query.id;

  const members = await person.listLegalPersonMembers(legalPersonId);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:person",
    members,
  );

  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const legalPersonId = request.query.id;

  // padrão do seu PATCH /persons/legal/[id]:
  // confirma que o user tem a feature update:person (gated + can())
  const targetLegalPerson = await person.findLegalById(legalPersonId);
  if (
    !authorization.can(userTryingToPost, "update:person", targetLegalPerson)
  ) {
    throw new ForbiddenError({
      message: "Você não possui permissão para atualizar essa pessoa.",
      action:
        "Verifique se você possui a feature necessária para atualizar essa pessoa.",
    });
  }

  const userInputValues = request.body;

  const createdMembership = await person.addLegalPersonMember({
    legal_person_id: legalPersonId, // vem da rota
    natural_person_id: userInputValues.natural_person_id,
    role: userInputValues.role,
  });

  const secureOutputValues = authorization.filterOutput(
    userTryingToPost,
    "read:person",
    createdMembership,
  );

  return response.status(201).json(secureOutputValues);
}

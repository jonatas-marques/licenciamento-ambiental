import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import pessoa from "models/pessoa.js";
import authorization from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:pessoa"), postHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const userInputValues = {
    ...request.body,
    criado_por: userTryingToPost.id, // Vem do servidor, não do Cliente!
  };
  const novaPessoa = await pessoa.createPessoaJuridica(userInputValues);

  const secureOutputValues = authorization.filterOutput(
    userTryingToPost,
    "create:pessoa",
    novaPessoa,
  );

  return response.status(201).json(secureOutputValues);
}

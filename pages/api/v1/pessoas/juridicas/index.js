import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import pessoa from "models/pessoa.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("update:user"), postHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const userInputValues = request.body;
  const novaPessoa = await pessoa.createPessoaJuridica(userInputValues);

  return response.status(201).json(novaPessoa);
}

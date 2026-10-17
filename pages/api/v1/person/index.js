import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import person from "models/person.js";
import user from "models/user.js";
import session from "models/session.js";
import authorization from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:person"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const sessionToken = request.cookies.session_id;

  const sessionObject = await session.findOneValidByToken(sessionToken);

  const userFound = await user.findOneById(sessionObject.user_id);

  const personFound = await person.findOneByUser(userFound);

  response.setHeader(
    "Cache-Control",
    "no-store, no-cache, max-age=0, must-revalidate",
  );

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:person:self",
    personFound,
  );

  return response.status(200).json(secureOutputValues);
}

import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import mce from "models/mce.js";
import { calculateWaterBalance } from "models/water-balance.js";
import { ValidationError } from "infra/errors.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:project"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const { id, flowchart_id } = request.query;
  if (typeof flowchart_id !== "string") {
    throw new ValidationError({
      message: "Fluxograma não informado.",
      action: "Informe flowchart_id.",
    });
  }
  const user = request.context.user;
  const [flowchart, operations, groups, flows, items, flowItems] =
    await Promise.all([
      mce.getItem("flowcharts", user, id, flowchart_id),
      mce.listItems("operations", user, id),
      mce.listItems("operation_groups", user, id),
      mce.listItems("flows", user, id),
      mce.listItems("items", user, id),
      mce.listItems("flow_items", user, id),
    ]);
  return response.status(200).json(
    calculateWaterBalance({
      flowchart,
      operations,
      groups,
      flows,
      items,
      flowItems,
    }),
  );
}

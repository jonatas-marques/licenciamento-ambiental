import { execFile } from "node:child_process";
import { promisify } from "node:util";
import database from "infra/database.js";
import orchestrator from "tests/orchestrator.js";
import { calculateWaterBalance } from "models/water-balance.js";

const execFileAsync = promisify(execFile);
const chartName = "Balanço hídrico — fontes e grupos (exemplo)";

beforeAll(async () => {
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

test("seed cria um balanço demonstrativo e preserva edições ao ser repetido", async () => {
  const seed = () =>
    execFileAsync(process.execPath, ["infra/scripts/seed-dev.mjs"], {
      env: process.env,
    });
  await seed();
  const chart = (
    await database.query({
      text: "SELECT * FROM flowcharts WHERE name = $1",
      values: [chartName],
    })
  ).rows[0];
  expect(chart).toBeDefined();
  const groups = (
    await database.query({
      text: "SELECT * FROM operation_groups WHERE flowchart_id = $1",
      values: [chart.id],
    })
  ).rows;
  const operations = (
    await database.query({
      text: "SELECT * FROM operations WHERE flowchart_id = $1",
      values: [chart.id],
    })
  ).rows;
  const flows = (
    await database.query({
      text: "SELECT * FROM flows WHERE flowchart_id = $1",
      values: [chart.id],
    })
  ).rows;
  const flowItems = (
    await database.query({
      text: "SELECT flow_items.* FROM flow_items JOIN flows ON flows.id = flow_items.flow_id WHERE flows.flowchart_id = $1",
      values: [chart.id],
    })
  ).rows;
  const items = (await database.query("SELECT * FROM items")).rows;
  const balance = calculateWaterBalance({
    flowchart: chart,
    groups,
    operations,
    flows,
    flowItems,
    items,
  });
  expect(groups).toHaveLength(2);
  expect(operations.filter((entry) => entry.group_id)).toHaveLength(2);
  expect(flows).toHaveLength(6);
  expect(flowItems).toHaveLength(6);
  expect(balance.incomplete).toBe(false);
  expect(balance.warnings).toEqual([]);
  expect(balance.totals).toEqual({
    input: 12000,
    output: 9000,
    difference: 3000,
  });
  expect(
    balance.rows.filter((row) => row.input).map((row) => row.source_type),
  ).toEqual(expect.arrayContaining(["subterranea", "rede_publica"]));
  expect(
    balance.rows.filter((row) => row.group_id).map((row) => row.use),
  ).toEqual(expect.arrayContaining(["industrial", "sanitario"]));
  expect(
    balance.rows.filter((row) => row.output).map((row) => row.destination_type),
  ).toEqual(expect.arrayContaining(["corpo_hidrico", "rede_coletora"]));

  await database.query({
    text: "UPDATE flow_items SET quantity = 7777 WHERE id = $1",
    values: [flowItems[0].id],
  });
  await seed();
  const result = await database.query({
    text: `
      SELECT
        (SELECT count(*)::int FROM operation_groups WHERE flowchart_id = $1) AS groups,
        (SELECT count(*)::int FROM operations WHERE flowchart_id = $1) AS operations,
        (SELECT count(*)::int FROM flows WHERE flowchart_id = $1) AS flows,
        (SELECT count(*)::int FROM flow_items JOIN flows ON flows.id = flow_items.flow_id WHERE flows.flowchart_id = $1) AS flow_items,
        (SELECT quantity FROM flow_items WHERE id = $2) AS edited_quantity
    `,
    values: [chart.id, flowItems[0].id],
  });
  expect(result.rows[0]).toMatchObject({
    groups: 2,
    operations: 7,
    flows: 6,
    flow_items: 6,
    edited_quantity: "7777",
  });
});

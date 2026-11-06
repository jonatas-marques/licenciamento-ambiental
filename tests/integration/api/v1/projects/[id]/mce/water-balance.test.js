import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

jest.mock("infra/webserver.js", () => ({
  __esModule: true,
  default: { origin: process.env.MCE_TEST_ORIGIN || "http://localhost:3000" },
}));

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

test("groups, boundary flows and the annual water balance share existing records", async () => {
  const owner = await orchestrator.activateUser(
    await orchestrator.createUser(),
  );
  const project = await orchestrator.createProject({ created_by: owner.id });
  const session = await orchestrator.createSession(owner);
  const headers = {
    Cookie: `session_id=${session.token}`,
    "Content-Type": "application/json",
  };
  const base = `${webserver.origin}/api/v1/projects/${project.id}/mce`;
  const post = (path, body) =>
    fetch(`${base}/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  expect((await fetch(base, { method: "POST", headers })).status).toBe(201);
  const chart = await (await post("flowcharts", { name: "Principal" })).json();
  const groupResponse = await post("operation_groups", {
    flowchart_id: chart.id,
    name: "Apoio",
    water_use: "sanitario",
  });
  expect(groupResponse.status).toBe(201);
  const group = await groupResponse.json();
  const source = await (
    await post("operations", {
      flowchart_id: chart.id,
      name: "Poço",
      boundary: "external",
      category: "fonte",
      water_type: "subterranea",
    })
  ).json();
  const stage = await (
    await post("operations", {
      flowchart_id: chart.id,
      name: "Banheiro",
      group_id: group.id,
    })
  ).json();
  const water = await (
    await post("items", { name: "Água", category: "agua" })
  ).json();
  const flowResponse = await post("flows", {
    flowchart_id: chart.id,
    source_operation_id: source.id,
    target_group_id: group.id,
  });
  expect(flowResponse.status).toBe(201);
  const flow = await flowResponse.json();
  const link = await post("flow_items", {
    flow_id: flow.id,
    item_id: water.id,
    quantity: 1200,
    unit: "m³/ano",
  });
  expect(link.status).toBe(201);
  const boundaryFlow = await post("flows", {
    flowchart_id: chart.id,
    source_boundary: true,
    target_operation_id: source.id,
  });
  expect(boundaryFlow.status).toBe(201);
  const invalid = await post("flows", {
    flowchart_id: chart.id,
    source_boundary: true,
    source_operation_id: source.id,
    target_group_id: group.id,
  });
  expect(invalid.status).toBe(400);
  const otherChart = await (await post("flowcharts", { name: "Outro" })).json();
  const crossChart = await post("operations", {
    flowchart_id: otherChart.id,
    name: "Etapa de outro fluxograma",
    group_id: group.id,
  });
  expect(crossChart.status).toBe(400);
  const otherGroup = await (
    await post("operation_groups", {
      flowchart_id: otherChart.id,
      name: "Outro grupo",
    })
  ).json();
  const otherSource = await (
    await post("operations", {
      flowchart_id: otherChart.id,
      name: "Outra etapa",
    })
  ).json();
  expect(
    (
      await post("flows", {
        flowchart_id: otherChart.id,
        source_operation_id: otherSource.id,
        target_group_id: otherGroup.id,
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await fetch(`${base}/flowcharts/${otherChart.id}`, {
        method: "DELETE",
        headers,
      })
    ).status,
  ).toBe(200);

  const result = await fetch(`${base}/water-balance?flowchart_id=${chart.id}`, {
    headers,
  });
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({
    totals: { input: 1200, output: 0 },
    rows: [{ source_type: "subterranea", use: "sanitario", annual: 1200 }],
  });
  const blocked = await fetch(`${base}/operation_groups/${group.id}`, {
    method: "DELETE",
    headers,
  });
  expect(blocked.status).toBe(409);
  const reconnected = await fetch(`${base}/flows/${flow.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      source_operation_id: source.id,
      source_group_id: null,
      source_boundary: false,
      target_operation_id: stage.id,
      target_group_id: null,
      target_boundary: false,
    }),
  });
  expect(reconnected.status).toBe(200);
  expect(await reconnected.json()).toMatchObject({
    target_operation_id: stage.id,
    target_group_id: null,
  });
  expect(
    (
      await fetch(`${base}/operation_groups/${group.id}`, {
        method: "DELETE",
        headers,
      })
    ).status,
  ).toBe(200);
  expect(
    (await (await fetch(`${base}/operations/${stage.id}`, { headers })).json())
      .group_id,
  ).toBeNull();
  expect(
    (await fetch(`${base}/flows/${flow.id}`, { method: "DELETE", headers }))
      .status,
  ).toBe(200);
  expect(
    (
      await fetch(`${base}/flowcharts/${chart.id}`, {
        method: "DELETE",
        headers,
      })
    ).status,
  ).toBe(200);
});

import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function setup(role = "owner") {
  const owner = await orchestrator.activateUser(
    await orchestrator.createUser(),
  );
  const project = await orchestrator.createProject({ created_by: owner.id });
  let actor = owner;

  if (role !== "owner") {
    actor = await orchestrator.activateUser(await orchestrator.createUser());
    await orchestrator.addMemberToProject(owner, {
      project_id: project.id,
      user_id: actor.id,
      role,
    });
  }

  const session = await orchestrator.createSession(actor);
  const headers = {
    Cookie: `session_id=${session.token}`,
    "Content-Type": "application/json",
  };
  const url = `${webserver.origin}/api/v1/projects/${project.id}/mce`;
  return { project, headers, url };
}

describe("MCE API", () => {
  test("Anonymous user cannot read the MCE", async () => {
    const project = await orchestrator.createProject();
    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/mce`,
    );
    expect(response.status).toBe(403);
  });

  test("Returns 404 before the MCE is created", async () => {
    const { headers, url } = await setup();
    const response = await fetch(url, { headers });
    expect(response.status).toBe(404);
  });

  test("Creates a single MCE per project", async () => {
    const { project, headers, url } = await setup();

    const created = await fetch(url, { method: "POST", headers });
    expect(created.status).toBe(201);
    const body = await created.json();
    expect(body.project_id).toBe(project.id);
    expect(body.status).toBe("draft");

    const duplicate = await fetch(url, { method: "POST", headers });
    expect(duplicate.status).toBe(409);

    const updated = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "completed" }),
    });
    expect(updated.status).toBe(200);
    expect((await updated.json()).status).toBe("completed");

    const invalid = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "x" }),
    });
    expect(invalid.status).toBe(400);
  });

  test("Viewer can read but cannot edit", async () => {
    const owner = await orchestrator.activateUser(
      await orchestrator.createUser(),
    );
    const project = await orchestrator.createProject({ created_by: owner.id });
    const ownerSession = await orchestrator.createSession(owner);
    const viewer = await orchestrator.activateUser(
      await orchestrator.createUser(),
    );
    await orchestrator.addMemberToProject(owner, {
      project_id: project.id,
      user_id: viewer.id,
      role: "viewer",
    });
    const viewerSession = await orchestrator.createSession(viewer);
    const url = `${webserver.origin}/api/v1/projects/${project.id}/mce`;

    await fetch(url, {
      method: "POST",
      headers: { Cookie: `session_id=${ownerSession.token}` },
    });

    const read = await fetch(url, {
      headers: { Cookie: `session_id=${viewerSession.token}` },
    });
    expect(read.status).toBe(200);

    const write = await fetch(`${url}/equipments`, {
      method: "POST",
      headers: {
        Cookie: `session_id=${viewerSession.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ custom_name: "Caldeira" }),
    });
    expect(write.status).toBe(403);
  });

  test.each([
    [
      "flowcharts",
      "name",
      { name: "Produção", activity: "Fabricação" },
      "description",
    ],
    [
      "equipments",
      "custom_name",
      { custom_name: "Caldeira", power: 10.5, mobility: "fixo" },
      "power",
    ],
  ])("CRUD of %s", async (collection, nameField, values, changedField) => {
    const { headers, url } = await setup();
    await fetch(url, { method: "POST", headers });
    const collectionUrl = `${url}/${collection}`;

    const created = await fetch(collectionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(values),
    });
    expect(created.status).toBe(201);
    const item = await created.json();
    expect(item.name).toBe(values[nameField]);
    expect(item).not.toHaveProperty("activity");

    const missingName = await fetch(collectionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ description: "sem nome" }),
    });
    expect(missingName.status).toBe(400);

    const list = await fetch(collectionUrl, { headers });
    expect(list.status).toBe(200);
    expect(await list.json()).toHaveLength(1);

    const patched = await fetch(`${collectionUrl}/${item.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        [nameField]: "Novo nome",
        [changedField]: changedField === "power" ? 20 : "Outra",
      }),
    });
    expect(patched.status).toBe(200);
    expect((await patched.json()).name).toBe("Novo nome");

    const removed = await fetch(`${collectionUrl}/${item.id}`, {
      method: "DELETE",
      headers,
    });
    expect(removed.status).toBe(200);

    const gone = await fetch(`${collectionUrl}/${item.id}`, { headers });
    expect(gone.status).toBe(404);
  });

  test("Equipment names dictionary", async () => {
    const { headers, url } = await setup();
    await fetch(url, { method: "POST", headers });

    const catalogResponse = await fetch(
      `${webserver.origin}/api/v1/equipment-catalog?q=caldeira`,
      { headers },
    );
    expect(catalogResponse.status).toBe(200);
    const catalog = await catalogResponse.json();
    const boiler = catalog.names.find((entry) => entry.name === "Caldeira");
    expect(boiler.category).toBe("Geração de calor");

    const modelsResponse = await fetch(
      `${webserver.origin}/api/v1/equipment-catalog?q=compress%20mecalor`,
      { headers },
    );
    const found = await modelsResponse.json();
    expect(found.models).toHaveLength(1);
    const compressor = found.models[0];
    expect(compressor.brand).toBe("Mecalor");

    const fromModel = await fetch(`${url}/equipments`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model_id: compressor.id,
        brand: compressor.brand,
        model: compressor.model,
        power: 20,
      }),
    });
    expect(fromModel.status).toBe(201);
    const modelItem = await fromModel.json();
    expect(modelItem.name).toBe("Compressor de ar");
    expect(modelItem.model_id).toBe(compressor.id);
    expect(Number(modelItem.power)).toBe(20);

    const created = await fetch(`${url}/equipments`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name_id: boiler.id,
        custom_name: "ignorado",
        power: 5,
      }),
    });
    expect(created.status).toBe(201);
    const item = await created.json();
    expect(item.name).toBe("Caldeira");
    expect(item.category).toBe("Geração de calor");
    expect(item.custom_name).toBeNull();

    const clearName = await fetch(`${url}/equipments/${item.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name_id: null }),
    });
    expect(clearName.status).toBe(400);

    const unknownName = await fetch(`${url}/equipments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name_id: crypto.randomUUID() }),
    });
    expect(unknownName.status).toBe(400);

    const badName = await fetch(`${url}/equipments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name_id: "abc" }),
    });
    expect(badName.status).toBe(400);
  });

  test("Manages operations, flows, items and flow items of a flowchart", async () => {
    const { headers, url } = await setup();
    await fetch(url, { method: "POST", headers });

    async function post(collection, body) {
      return await fetch(`${url}/${collection}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    }

    const flowchart = await (await post("flowcharts", { name: "A" })).json();
    const other = await (await post("flowcharts", { name: "B" })).json();

    const first = await post("operations", {
      flowchart_id: flowchart.id,
      name: "Corte",
      boundary: "internal",
    });
    expect(first.status).toBe(201);
    const source = await first.json();
    const target = await (
      await post("operations", { flowchart_id: flowchart.id, name: "Pintura" })
    ).json();
    const foreign = await (
      await post("operations", { flowchart_id: other.id, name: "Outra" })
    ).json();
    expect(target.boundary).toBe("internal");

    const badBoundary = await post("operations", {
      flowchart_id: flowchart.id,
      name: "X",
      boundary: "middle",
    });
    expect(badBoundary.status).toBe(400);

    const crossFlow = await post("flows", {
      flowchart_id: flowchart.id,
      source_operation_id: source.id,
      target_operation_id: foreign.id,
    });
    expect(crossFlow.status).toBe(400);

    const flowResponse = await post("flows", {
      flowchart_id: flowchart.id,
      source_operation_id: source.id,
      target_operation_id: target.id,
      label: "Peças cortadas",
    });
    expect(flowResponse.status).toBe(201);
    const flow = await flowResponse.json();

    const item = await (
      await post("items", { name: "Chapa de aço", category: "insumo" })
    ).json();
    const flowItem = await post("flow_items", {
      flow_id: flow.id,
      item_id: item.id,
      quantity: 10,
      unit: "kg",
    });
    expect(flowItem.status).toBe(201);

    const badUnit = await post("flow_items", {
      flow_id: flow.id,
      item_id: item.id,
      quantity: 1,
      unit: "toneladas",
    });
    expect(badUnit.status).toBe(400);

    const move = await fetch(`${url}/flows/${flow.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ flowchart_id: other.id }),
    });
    expect(move.status).toBe(400);

    const bendResponse = await fetch(`${url}/flows/${flow.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ bend_ratio: 0.3 }),
    });
    expect(bendResponse.status).toBe(200);
    expect(Number((await bendResponse.json()).bend_ratio)).toBe(0.3);

    const badBend = await fetch(`${url}/flows/${flow.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ bend_ratio: 1.5 }),
    });
    expect(badBend.status).toBe(400);

    const removed = await fetch(`${url}/operations/${source.id}`, {
      method: "DELETE",
      headers,
    });
    expect(removed.status).toBe(200);
    const flows = await (await fetch(`${url}/flows`, { headers })).json();
    expect(flows).toHaveLength(0);
  });

  test("Stores the boundary area, operation categories and item subtypes", async () => {
    const { headers, url } = await setup();
    await fetch(url, { method: "POST", headers });

    async function send(path, method, body) {
      return await fetch(`${url}/${path}`, {
        method,
        headers,
        body: JSON.stringify(body),
      });
    }

    const flowchart = await (
      await send("flowcharts", "POST", { name: "A" })
    ).json();
    expect(Number(flowchart.boundary_width)).toBe(400);

    const resized = await send(`flowcharts/${flowchart.id}`, "PATCH", {
      boundary_width: 800,
      boundary_height: 400,
    });
    expect(Number((await resized.json()).boundary_width)).toBe(800);

    const source = await send("operations", "POST", {
      flowchart_id: flowchart.id,
      name: "Captação",
      boundary: "external",
      category: "fonte",
    });
    expect(source.status).toBe(201);
    expect((await source.json()).category).toBe("fonte");

    const badCategory = await send("operations", "POST", {
      flowchart_id: flowchart.id,
      name: "X",
      category: "decisao",
    });
    expect(badCategory.status).toBe(400);

    const created = await send("items", "POST", {
      name: "Borra",
      category: "residuo",
      details: { hazard_class: "I", ibama_code: "130208" },
    });
    expect(created.status).toBe(201);
    const waste = await created.json();
    expect(waste.details).toEqual({
      hazard_class: "I",
      abnt_class: null,
      ibama_code: "130208",
      final_destination: null,
      notes: null,
    });

    const onlyDetails = await send(`items/${waste.id}`, "PATCH", {
      details: { final_destination: "Coprocessamento" },
    });
    expect((await onlyDetails.json()).details.final_destination).toBe(
      "Coprocessamento",
    );

    const changed = await send(`items/${waste.id}`, "PATCH", {
      category: "efluente",
      details: { treated: true },
    });
    const effluent = await changed.json();
    expect(effluent.details).toEqual({
      type: null,
      treated: true,
      final_destination: null,
    });

    const plain = await send(`items/${waste.id}`, "PATCH", {
      category: "insumo",
    });
    expect((await plain.json()).details).toBeNull();

    const badDetails = await send("items", "POST", {
      name: "Y",
      category: "emissao",
      details: { emission_factor: "abc" },
    });
    expect(badDetails.status).toBe(400);
  });

  test("Unknown collection returns 404", async () => {
    const { headers, url } = await setup();
    await fetch(url, { method: "POST", headers });
    const response = await fetch(`${url}/unknown`, { headers });
    expect(response.status).toBe(404);
  });
});

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
      "activity",
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

  test("Unknown collection returns 404", async () => {
    const { headers, url } = await setup();
    await fetch(url, { method: "POST", headers });
    const response = await fetch(`${url}/unknown`, { headers });
    expect(response.status).toBe(404);
  });
});

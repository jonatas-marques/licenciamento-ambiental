import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("PATCH /api/v1/projects/[id]/mces/[mce_id]", () => {
  test("An owner can archive a draft while preserving it", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const session = await orchestrator.createSession(activatedOwner);
    const project = await orchestrator.createProject({
      created_by: activatedOwner.id,
    });

    const createResponse = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/mces`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({}),
      },
    );
    const createdMce = await createResponse.json();

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/mces/${createdMce.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({ status: "archived" }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        id: createdMce.id,
        status: "archived",
        updated_by: activatedOwner.id,
      }),
    );
  });

  test("A viewer cannot archive a draft", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const ownerSession = await orchestrator.createSession(activatedOwner);
    const project = await orchestrator.createProject({
      created_by: activatedOwner.id,
    });

    const createResponse = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/mces`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${ownerSession.token}`,
        },
        body: JSON.stringify({}),
      },
    );
    const createdMce = await createResponse.json();

    const viewer = await orchestrator.createUser();
    const activatedViewer = await orchestrator.activateUser(viewer);
    await orchestrator.addMemberToProject(activatedOwner, {
      project_id: project.id,
      user_id: activatedViewer.id,
      role: "viewer",
    });
    const viewerSession = await orchestrator.createSession(activatedViewer);

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/mces/${createdMce.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${viewerSession.token}`,
        },
        body: JSON.stringify({ status: "archived" }),
      },
    );

    expect(response.status).toBe(403);
  });

  test("Rejects unsupported fields and updates to archived versions", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const session = await orchestrator.createSession(activatedOwner);
    const project = await orchestrator.createProject({
      created_by: activatedOwner.id,
    });

    const createResponse = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/mces`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({}),
      },
    );
    const createdMce = await createResponse.json();
    const endpoint = `${webserver.origin}/api/v1/projects/${project.id}/mces/${createdMce.id}`;

    const invalidBodyResponse = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({ status: "submitted", version: 999 }),
    });
    expect(invalidBodyResponse.status).toBe(400);

    const archiveResponse = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({ status: "archived" }),
    });
    expect(archiveResponse.status).toBe(200);

    const secondArchiveResponse = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({ status: "archived" }),
    });
    expect(secondArchiveResponse.status).toBe(409);
  });
});

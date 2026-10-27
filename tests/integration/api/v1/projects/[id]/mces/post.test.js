import database from "infra/database.js";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/projects/[id]/mces", () => {
  test("Anonymous users cannot create a version", async () => {
    const response = await fetch(
      `${webserver.origin}/api/v1/projects/00000000-0000-4000-8000-000000000000/mces`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(403);
  });

  test("Owner creates sequential drafts after archiving the previous one", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const session = await orchestrator.createSession(activatedOwner);
    const project = await orchestrator.createProject({
      name: "MCE sequential version project",
      created_by: activatedOwner.id,
    });
    const endpoint = `${webserver.origin}/api/v1/projects/${project.id}/mces`;

    const firstResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({}),
    });

    expect(firstResponse.status).toBe(201);
    const firstVersion = await firstResponse.json();
    expect(firstVersion).toEqual(
      expect.objectContaining({
        project_id: project.id,
        version: 1,
        status: "draft",
        created_by: activatedOwner.id,
        updated_by: activatedOwner.id,
      }),
    );

    const duplicateDraftResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({}),
    });
    expect(duplicateDraftResponse.status).toBe(409);

    const archiveResponse = await fetch(`${endpoint}/${firstVersion.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({ status: "archived" }),
    });
    expect(archiveResponse.status).toBe(200);

    const secondResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({}),
    });

    expect(secondResponse.status).toBe(201);
    expect(await secondResponse.json()).toEqual(
      expect.objectContaining({
        project_id: project.id,
        version: 2,
        status: "draft",
        created_by: activatedOwner.id,
      }),
    );

    const versions = await database.query({
      text: `
        SELECT version, status
        FROM mces
        WHERE project_id = $1
        ORDER BY version;
      `,
      values: [project.id],
    });
    expect(versions.rows).toEqual([
      { version: 1, status: "archived" },
      { version: 2, status: "draft" },
    ]);
  });

  test("Only managers can create a version and clients cannot set audit fields", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const project = await orchestrator.createProject({
      name: "MCE manager permissions project",
      created_by: activatedOwner.id,
    });

    const viewer = await orchestrator.createUser();
    const activatedViewer = await orchestrator.activateUser(viewer);
    await orchestrator.addMemberToProject(activatedOwner, {
      project_id: project.id,
      user_id: activatedViewer.id,
      role: "viewer",
    });
    const viewerSession = await orchestrator.createSession(activatedViewer);
    const endpoint = `${webserver.origin}/api/v1/projects/${project.id}/mces`;

    const forbiddenResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${viewerSession.token}`,
      },
      body: JSON.stringify({}),
    });
    expect(forbiddenResponse.status).toBe(403);

    const ownerSession = await orchestrator.createSession(activatedOwner);
    const massAssignmentResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${ownerSession.token}`,
      },
      body: JSON.stringify({
        project_id: "00000000-0000-4000-8000-000000000000",
        version: 999,
        status: "submitted",
        created_by: viewer.id,
      }),
    });
    expect(massAssignmentResponse.status).toBe(400);

    const versions = await database.query({
      text: "SELECT id FROM mces WHERE project_id = $1;",
      values: [project.id],
    });
    expect(versions.rowCount).toBe(0);
  });

  test("Cannot create MCE versions for archived projects", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const session = await orchestrator.createSession(activatedOwner);
    const project = await orchestrator.createProject({
      name: "MCE archived project",
      created_by: activatedOwner.id,
    });
    await database.query({
      text: "UPDATE projects SET status = 'archived' WHERE id = $1;",
      values: [project.id],
    });

    const response = await fetch(
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

    expect(response.status).toBe(409);
  });

  test("Concurrent requests create only one active draft", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const session = await orchestrator.createSession(activatedOwner);
    const project = await orchestrator.createProject({
      name: "MCE concurrent creation project",
      created_by: activatedOwner.id,
    });
    const endpoint = `${webserver.origin}/api/v1/projects/${project.id}/mces`;
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({}),
    };

    const responses = await Promise.all([
      fetch(endpoint, options),
      fetch(endpoint, options),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const drafts = await database.query({
      text: `
        SELECT version
        FROM mces
        WHERE project_id = $1
          AND status = 'draft';
      `,
      values: [project.id],
    });
    expect(drafts.rows).toEqual([{ version: 1 }]);
  });
});

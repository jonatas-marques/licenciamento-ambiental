import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/projects/[id]/mces/[mce_id]", () => {
  test("A project member can read a version; an outsider cannot", async () => {
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
        headers: { Cookie: `session_id=${viewerSession.token}` },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        id: createdMce.id,
        project_id: project.id,
        version: 1,
        status: "draft",
      }),
    );

    const outsider = await orchestrator.createUser();
    const activatedOutsider = await orchestrator.activateUser(outsider);
    const outsiderSession = await orchestrator.createSession(activatedOutsider);
    const forbiddenResponse = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/mces/${createdMce.id}`,
      {
        headers: { Cookie: `session_id=${outsiderSession.token}` },
      },
    );
    expect(forbiddenResponse.status).toBe(403);
  });

  test("Does not expose a version from a different project", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const session = await orchestrator.createSession(activatedOwner);
    const project = await orchestrator.createProject({
      created_by: activatedOwner.id,
    });
    const otherProject = await orchestrator.createProject({
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
      `${webserver.origin}/api/v1/projects/${otherProject.id}/mces/${createdMce.id}`,
      {
        headers: { Cookie: `session_id=${session.token}` },
      },
    );

    expect(response.status).toBe(404);
  });
});

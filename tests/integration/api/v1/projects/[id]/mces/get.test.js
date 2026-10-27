import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/projects/[id]/mces", () => {
  test("Anonymous users cannot list MCE versions", async () => {
    const response = await fetch(
      `${webserver.origin}/api/v1/projects/00000000-0000-4000-8000-000000000000/mces`,
    );

    expect(response.status).toBe(403);
  });

  test("Project members can list versions but outsiders cannot", async () => {
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
    expect(createResponse.status).toBe(201);
    const createdMce = await createResponse.json();

    const viewer = await orchestrator.createUser();
    const activatedViewer = await orchestrator.activateUser(viewer);
    await orchestrator.addMemberToProject(activatedOwner, {
      project_id: project.id,
      user_id: activatedViewer.id,
      role: "viewer",
    });
    const viewerSession = await orchestrator.createSession(activatedViewer);

    const listResponse = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/mces`,
      {
        headers: { Cookie: `session_id=${viewerSession.token}` },
      },
    );

    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual([
      expect.objectContaining({
        id: createdMce.id,
        project_id: project.id,
        version: 1,
        status: "draft",
      }),
    ]);

    const outsider = await orchestrator.createUser();
    const activatedOutsider = await orchestrator.activateUser(outsider);
    const outsiderSession = await orchestrator.createSession(activatedOutsider);
    const forbiddenResponse = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/mces`,
      {
        headers: { Cookie: `session_id=${outsiderSession.token}` },
      },
    );
    expect(forbiddenResponse.status).toBe(403);
  });
});

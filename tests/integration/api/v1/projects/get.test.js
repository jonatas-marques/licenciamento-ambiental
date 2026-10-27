import database from "infra/database.js";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/projects", () => {
  test("Anonymous user cannot list projects", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/projects`);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      name: "ForbiddenError",
      message: "Você não possui permissão para executar esta ação.",
      action: 'Verifique se o seu usuário possui a feature "read:project".',
      status_code: 403,
    });
  });

  test("Lists only active projects of the authenticated user", async () => {
    const user = await orchestrator.createUser();
    const activatedUser = await orchestrator.activateUser(user);
    const session = await orchestrator.createSession(activatedUser);
    const ownProject = await orchestrator.createProject({
      name: "Projeto do usuário",
      created_by: activatedUser.id,
    });

    const otherUser = await orchestrator.createUser();
    const activatedOtherUser = await orchestrator.activateUser(otherUser);
    await orchestrator.createProject({
      name: "Projeto de outra pessoa",
      created_by: activatedOtherUser.id,
    });

    const expiredProject = await orchestrator.createProject({
      name: "Projeto com vínculo expirado",
      created_by: activatedOtherUser.id,
    });
    await database.query({
      text: `
        INSERT INTO project_members (
          project_id,
          user_id,
          role,
          valid_from,
          valid_to
        )
        VALUES (
          $1,
          $2,
          'member',
          timezone('utc', now()) - interval '2 days',
          timezone('utc', now()) - interval '1 day'
        );
      `,
      values: [expiredProject.id, activatedUser.id],
    });

    const response = await fetch(`${webserver.origin}/api/v1/projects`, {
      headers: {
        Cookie: `session_id=${session.token}`,
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "no-store, no-cache, max-age=0, must-revalidate",
    );
    const responseBody = await response.json();

    expect(responseBody).toHaveLength(1);
    expect(responseBody[0]).toEqual(
      expect.objectContaining({
        id: ownProject.id,
        name: ownProject.name,
        created_by: activatedUser.id,
      }),
    );
  });
});

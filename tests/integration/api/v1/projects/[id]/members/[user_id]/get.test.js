import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/projects/[id]/members/[user_id]", () => {
  test("Anonymous user cannot get membership", async () => {
    const project = await orchestrator.createProject();
    const someUser = await orchestrator.createUser();

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/members/${someUser.id}`,
    );

    expect(response.status).toBe(403);

    const responseBody = await response.json();
    expect(responseBody).toEqual({
      name: "ForbiddenError",
      message: "Você não possui permissão para executar esta ação.",
      action: 'Verifique se o seu usuário possui a feature "read:project".',
      status_code: 403,
    });
  });

  test("Owner can get membership", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const ownerSession = await orchestrator.createSession(activatedOwner);

    const project = await orchestrator.createProject({
      created_by: activatedOwner.id,
    });

    const member = await orchestrator.createUser();
    await orchestrator.activateUser(member);

    await orchestrator.addMemberToProject(activatedOwner, {
      project_id: project.id,
      user_id: member.id,
      role: "member",
    });

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/members/${member.id}`,
      {
        headers: {
          Cookie: `session_id=${ownerSession.token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const responseBody = await response.json();

    expect(responseBody).toEqual(
      expect.objectContaining({
        project_id: project.id,
        user_id: member.id,
        role: "member",
      }),
    );
  });

  test("Member not found returns 404", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const ownerSession = await orchestrator.createSession(activatedOwner);

    const project = await orchestrator.createProject({
      created_by: activatedOwner.id,
    });

    const notAMember = await orchestrator.createUser();

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/members/${notAMember.id}`,
      {
        headers: {
          Cookie: `session_id=${ownerSession.token}`,
        },
      },
    );

    expect(response.status).toBe(404);
    const responseBody = await response.json();

    expect(responseBody).toEqual({
      name: "NotFoundError",
      message: "Membro do projeto não encontrado.",
      action: "Verifique o ID do projeto e do usuário informado.",
      status_code: 404,
    });
  });
});

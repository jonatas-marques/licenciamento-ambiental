import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("PATCH /api/v1/projects/[id]/members/[user_id]", () => {
  test("Anonymous user cannot patch membership", async () => {
    const project = await orchestrator.createProject();
    const user = await orchestrator.createUser();

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/members/${user.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "viewer" }),
      },
    );

    expect(response.status).toBe(403);
    const responseBody = await response.json();

    expect(responseBody).toEqual({
      name: "ForbiddenError",
      message: "Você não possui permissão para executar esta ação.",
      action: 'Verifique se o seu usuário possui a feature "update:project".',
      status_code: 403,
    });
  });

  test("Member cannot patch membership", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);

    const project = await orchestrator.createProject({
      created_by: activatedOwner.id,
    });

    const member = await orchestrator.createUser();
    const activatedMember = await orchestrator.activateUser(member);
    await orchestrator.addMemberToProject(activatedOwner, {
      project_id: project.id,
      user_id: activatedMember.id,
      role: "member",
    });

    const memberSession = await orchestrator.createSession(activatedMember);

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/members/${activatedMember.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${memberSession.token}`,
        },
        body: JSON.stringify({ role: "viewer" }),
      },
    );

    expect(response.status).toBe(403);
    const responseBody = await response.json();

    expect(responseBody).toEqual({
      name: "ForbiddenError",
      message: "Você não possui permissão para gerenciar membros do projeto.",
      action:
        "Apenas usuários com role 'owner' ou 'admin' podem gerenciar membros.",
      status_code: 403,
    });
  });

  test("Admin can patch member role", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);

    const project = await orchestrator.createProject({
      created_by: activatedOwner.id,
    });

    const admin = await orchestrator.createUser();
    const activatedAdmin = await orchestrator.activateUser(admin);
    await orchestrator.addMemberToProject(activatedOwner, {
      project_id: project.id,
      user_id: activatedAdmin.id,
      role: "admin",
    });

    const member = await orchestrator.createUser();
    const activatedMember = await orchestrator.activateUser(member);
    await orchestrator.addMemberToProject(activatedOwner, {
      project_id: project.id,
      user_id: activatedMember.id,
      role: "member",
    });

    const adminSession = await orchestrator.createSession(activatedAdmin);

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/members/${activatedMember.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${adminSession.token}`,
        },
        body: JSON.stringify({ role: "viewer" }),
      },
    );

    expect(response.status).toBe(200);
    const responseBody = await response.json();

    expect(responseBody).toEqual(
      expect.objectContaining({
        project_id: project.id,
        user_id: activatedMember.id,
        role: "viewer",
      }),
    );
  });
});

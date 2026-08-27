import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("DELETE /api/v1/projects/[id]/members/[user_id]", () => {
  test("Admin can delete member", async () => {
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
        method: "DELETE",
        headers: {
          Cookie: `session_id=${adminSession.token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const responseBody = await response.json();

    expect(responseBody).toEqual(
      expect.objectContaining({
        project_id: project.id,
        user_id: activatedMember.id,
      }),
    );

    // Agora deve retornar 404 (admin ainda é membro e pode consultar)
    const response2 = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/members/${activatedMember.id}`,
      {
        headers: {
          Cookie: `session_id=${adminSession.token}`,
        },
      },
    );

    expect(response2.status).toBe(404);
  });

  test("Admin cannot delete owner (only owner can)", async () => {
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

    const adminSession = await orchestrator.createSession(activatedAdmin);

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/members/${activatedOwner.id}`,
      {
        method: "DELETE",
        headers: {
          Cookie: `session_id=${adminSession.token}`,
        },
      },
    );

    expect(response.status).toBe(403);
    const responseBody = await response.json();

    expect(responseBody).toEqual({
      name: "ForbiddenError",
      message: "Apenas o owner pode gerenciar outro owner.",
      action: "Solicite ao proprietário do projeto para executar esta ação.",
      status_code: 403,
    });
  });
});

import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import party from "models/party.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("DELETE /api/v1/projects/[id]/parties/[party_id]", () => {
  test("Admin can delete party", async () => {
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

    const createdNatural = await orchestrator.createNaturalPerson();
    const created = await party.addParty(activatedOwner, project.id, {
      person_cp: createdNatural.cpf,
      interest: "interessado",
    });

    const adminSession = await orchestrator.createSession(activatedAdmin);
    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties/${created.id}`,
      {
        method: "DELETE",
        headers: { Cookie: `session_id=${adminSession.token}` },
      },
    );

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual(
      expect.objectContaining({
        id: created.id,
        project_id: project.id,
      }),
    );

    // Agora deve retornar 404 (admin ainda é membro e pode consultar)
    const response2 = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties/${created.id}`,
      { headers: { Cookie: `session_id=${adminSession.token}` } },
    );

    expect(response2.status).toBe(404);
  });
});

import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import party from "models/party.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/projects/[id]/parties/[party_id]", () => {
  test("Anonymous user cannot get party", async () => {
    const project = await orchestrator.createProject();
    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties/00000000-0000-0000-0000-000000000000`,
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

  test("Owner can get party", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const ownerSession = await orchestrator.createSession(activatedOwner);

    const project = await orchestrator.createProject({
      created_by: activatedOwner.id,
    });
    const legal = await orchestrator.createLegalPerson();

    const created = await party.addParty(activatedOwner, project.id, {
      person_cp: legal.cnpj,
      interest: "consultor",
    });

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties/${created.id}`,
      { headers: { Cookie: `session_id=${ownerSession.token}` } },
    );

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual(
      expect.objectContaining({
        id: created.id,
        project_id: project.id,
        person_cp: legal.cnpj,
        interest: "consultor",
      }),
    );
  });

  test("Party not found returns 404", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const ownerSession = await orchestrator.createSession(activatedOwner);

    const project = await orchestrator.createProject({
      created_by: activatedOwner.id,
    });

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties/00000000-0000-0000-0000-000000000000`,
      { headers: { Cookie: `session_id=${ownerSession.token}` } },
    );

    expect(response.status).toBe(404);
    const responseBody = await response.json();
    expect(responseBody).toEqual({
      name: "NotFoundError",
      message: "Parte interessada não encontrada.",
      action: "Verifique o ID do projeto e da parte interessada informado.",
      status_code: 404,
    });
  });
});

import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import party from "models/party.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("PATCH /api/v1/projects/[id]/parties/[party_id]", () => {
  test("Anonymous user cannot patch party", async () => {
    const project = await orchestrator.createProject();

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties/00000000-0000-0000-0000-000000000000`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interest: "outro" }),
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

  test("Member cannot patch party", async () => {
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

    const createdNatural = await orchestrator.createNaturalPerson();
    const created = await party.addParty(activatedOwner, project.id, {
      person_cp: createdNatural.cpf,
      interest: "interessado",
    });

    const memberSession = await orchestrator.createSession(activatedMember);
    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties/${created.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${memberSession.token}`,
        },
        body: JSON.stringify({ interest: "outro" }),
      },
    );

    expect(response.status).toBe(403);
    const responseBody = await response.json();
    expect(responseBody).toEqual({
      name: "ForbiddenError",
      message:
        "Você não possui permissão para gerenciar partes interessadas do projeto.",
      action:
        "Apenas usuários com role 'owner' ou 'admin' podem gerenciar partes interessadas.",
      status_code: 403,
    });
  });

  test("Admin can patch party interest", async () => {
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
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${adminSession.token}`,
        },
        body: JSON.stringify({ interest: "consultor" }),
      },
    );

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual(
      expect.objectContaining({
        id: created.id,
        project_id: project.id,
        person_cp: createdNatural.cpf,
        interest: "consultor",
      }),
    );
  });
});

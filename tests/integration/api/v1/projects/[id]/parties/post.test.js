import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/projects/[id]/parties", () => {
  test("Anonymous user cannot create party", async () => {
    const project = await orchestrator.createProject();
    const natural = await orchestrator.createNaturalPerson();

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_cp: natural.cpf,
          interest: "interessado",
        }),
      },
    );

    expect(response.status).toBe(403);
    const responseBody = await response.json();
    expect(responseBody).toEqual({
      name: "ForbiddenError",
      message: "Você não possui permissão para executar esta ação.",
      action: 'Verifique se o seu usuário possui a feature "create:project".',
      status_code: 403,
    });
  });

  test("Member cannot create party", async () => {
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
    const natural = await orchestrator.createNaturalPerson();

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${memberSession.token}`,
        },
        body: JSON.stringify({
          person_cp: natural.cpf,
          interest: "interessado",
        }),
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

  test("Owner can create party", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const ownerSession = await orchestrator.createSession(activatedOwner);

    const project = await orchestrator.createProject({
      created_by: activatedOwner.id,
    });
    const natural = await orchestrator.createNaturalPerson();

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${ownerSession.token}`,
        },
        body: JSON.stringify({
          person_cp: natural.cpf,
          interest: "interessado",
        }),
      },
    );

    expect(response.status).toBe(201);
    const responseBody = await response.json();
    expect(responseBody).toEqual(
      expect.objectContaining({
        project_id: project.id,
        person_cp: natural.cpf,
        interest: "interessado",
      }),
    );
  });

  test("Admin can create party", async () => {
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
    const legal = await orchestrator.createLegalPerson();

    const response = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${adminSession.token}`,
        },
        body: JSON.stringify({ person_cp: legal.cnpj, interest: "consultor" }),
      },
    );

    expect(response.status).toBe(201);
    const responseBody = await response.json();
    expect(responseBody).toEqual(
      expect.objectContaining({
        project_id: project.id,
        person_cp: legal.cnpj,
        interest: "consultor",
      }),
    );
  });

  test("Cannot create duplicated party for same person_cp", async () => {
    const owner = await orchestrator.createUser();
    const activatedOwner = await orchestrator.activateUser(owner);
    const ownerSession = await orchestrator.createSession(activatedOwner);

    const project = await orchestrator.createProject({
      created_by: activatedOwner.id,
    });
    const natural = await orchestrator.createNaturalPerson();

    const response1 = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${ownerSession.token}`,
        },
        body: JSON.stringify({
          person_cp: natural.cpf,
          interest: "interessado",
        }),
      },
    );
    expect(response1.status).toBe(201);

    const response2 = await fetch(
      `${webserver.origin}/api/v1/projects/${project.id}/parties`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${ownerSession.token}`,
        },
        body: JSON.stringify({
          person_cp: natural.cpf,
          interest: "interessado",
        }),
      },
    );

    expect(response2.status).toBe(400);
    const responseBody = await response2.json();
    expect(responseBody).toEqual({
      name: "ValidationError",
      message: "Pessoa já é parte interessada neste projeto.",
      action:
        "Tente cadastrar outra pessoa ou remova a parte interessada existente.",
      status_code: 400,
    });
  });
});

import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/projects/[id]/members", () => {
  describe("Anonymous user", () => {
    test("With valid data", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/projects/[id]/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project_id: "00000000-0000-0000-0000-000000000000",
            user_id: "00000000-0000-0000-0000-000000000000",
            role: "member",
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
  });

  describe("Default user", () => {
    /*
Preciso revisar esses testes para garantir o fluxo real de criação de projeto e adição de membros,
pois atualmente estou criando um projeto e adicionando um membro diretamente, sem passar pelo fluxo real,
 o que pode não refletir o comportamento real da aplicação.

 É importante criar um projeto através do endpoint de criação de projetos e, em seguida, usar o ID do projeto criado para adicionar membros.
*/

    // Teste para garantir que membros já existentes no projeto não possam ser novamente adicionados.

    test("With existent member", async () => {
      const user = await orchestrator.createUser();
      const activatedUser = await orchestrator.activateUser(user);
      const userSessionObject = await orchestrator.createSession(activatedUser);

      const projectObject = {
        created_by: activatedUser.id,
      };
      const project = await orchestrator.createProject(projectObject);

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${project.id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${userSessionObject.token}`,
          },
          body: JSON.stringify({
            project_id: project.id,
            user_id: activatedUser.id, // Adicionar o próprio owner como membro do projeto
            role: "owner",
          }),
        },
      );

      expect(response.status).toBe(400);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        action: "Tente adicionar outro usuário ao projeto.",
        message: "Usuário já é membro do projeto.",
        name: "ValidationError",
        status_code: 400,
      });
    });

    test("Owner adds new member", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const ownerSessionObject =
        await orchestrator.createSession(activatedOwner);

      const projectObject = { created_by: activatedOwner.id };
      const project = await orchestrator.createProject(projectObject);

      const newMember = await orchestrator.createUser();

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${project.id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${ownerSessionObject.token}`,
          },
          body: JSON.stringify({
            project_id: project.id,
            user_id: newMember.id,
            role: "member",
          }),
        },
      );

      expect(response.status).toBe(201);
      // const responseBody = await response.json();
    });

    test("Admin adds new member", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);

      const project = await orchestrator.createProject({
        created_by: activatedOwner.id,
      });

      // Adiciona admin ao projeto
      const admin = await orchestrator.createUser();
      await orchestrator.activateUser(admin);
      await orchestrator.addMemberToProject(owner, {
        project_id: project.id,
        user_id: admin.id,
        role: "admin",
      });

      // Admin adiciona membro ao projeto
      const adminSessionObject = await orchestrator.createSession(admin);

      const newMember = await orchestrator.createUser();

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${project.id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${adminSessionObject.token}`,
          },
          body: JSON.stringify({
            project_id: project.id,
            user_id: newMember.id,
            role: "member",
          }),
        },
      );
      expect(response.status).toBe(201);
    });

    test("Member cannot add members", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);

      const project = await orchestrator.createProject({
        created_by: activatedOwner.id,
      });

      // Adiciona member ao projeto
      const member = await orchestrator.createUser();
      await orchestrator.activateUser(member);
      await orchestrator.addMemberToProject(owner, {
        project_id: project.id,
        user_id: member.id,
        role: "member",
      });

      // Member adiciona membro ao projeto
      const memberSessionObject = await orchestrator.createSession(member);

      const user = await orchestrator.createUser();

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${project.id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${memberSessionObject.token}`,
          },
          body: JSON.stringify({
            project_id: project.id,
            user_id: user.id,
            role: "member",
          }),
        },
      );
      expect(response.status).toBe(403);
    });

    test("Viewer cannot add members", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);

      const project = await orchestrator.createProject({
        created_by: activatedOwner.id,
      });

      // Adiciona viewer ao projeto
      const viewer = await orchestrator.createUser();
      await orchestrator.activateUser(viewer);
      await orchestrator.addMemberToProject(owner, {
        project_id: project.id,
        user_id: viewer.id,
        role: "viewer",
      });

      // Viewer adiciona membro ao projeto
      const viewerSessionObject = await orchestrator.createSession(viewer);

      const user = await orchestrator.createUser();

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${project.id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${viewerSessionObject.token}`,
          },
          body: JSON.stringify({
            project_id: project.id,
            user_id: user.id,
            role: "member",
          }),
        },
      );
      expect(response.status).toBe(403);
    });

    // Teste para garantir que não seja possível adicionar um membro a um projeto inexistente.
  });
});

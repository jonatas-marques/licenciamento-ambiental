import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/projects/[id]/members", () => {
  describe("Anonymous user", () => {
    test("Cannot list members", async () => {
      const project = await orchestrator.createProject();

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${project.id}/members`,
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
  });

  describe("Authenticated user", () => {
    test("Non-member cannot list members", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const project = await orchestrator.createProject({
        created_by: activatedOwner.id,
      });

      const outsider = await orchestrator.createUser();
      const activatedOutsider = await orchestrator.activateUser(outsider);
      const outsiderSession =
        await orchestrator.createSession(activatedOutsider);

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${project.id}/members`,
        {
          headers: {
            Cookie: `session_id=${outsiderSession.token}`,
          },
        },
      );

      expect(response.status).toBe(403);
      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não é membro deste projeto.",
        action: "Solicite acesso ao proprietário do projeto.",
        status_code: 403,
      });
    });

    test("Owner can list members", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const ownerSession = await orchestrator.createSession(activatedOwner);

      const project = await orchestrator.createProject({
        created_by: activatedOwner.id,
      });

      const member = await orchestrator.createUser();
      await orchestrator.activateUser(member);

      // owner adiciona um membro
      await orchestrator.addMemberToProject(activatedOwner, {
        project_id: project.id,
        user_id: member.id,
        role: "member",
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${project.id}/members`,
        {
          headers: {
            Cookie: `session_id=${ownerSession.token}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(Array.isArray(responseBody)).toBe(true);

      // Deve conter o owner
      expect(responseBody).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            project_id: project.id,
            user_id: activatedOwner.id,
            role: "owner",
          }),
        ]),
      );

      // Deve conter o member
      expect(responseBody).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            project_id: project.id,
            user_id: member.id,
            role: "member",
          }),
        ]),
      );
    });
  });
});

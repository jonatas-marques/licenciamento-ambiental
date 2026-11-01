import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/projects/[id]", () => {
  describe("Anonymous user", () => {
    test("Cannot read a project", async () => {
      const project = await orchestrator.createProject({
        created_by: (await orchestrator.createUser()).id,
        name: "Test Project",
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${project.id}`,
      );

      expect(response.status).toBe(403);
    });

    test("With nonexistent `id`", async () => {
      // Random ID: 766d50d5-c8b8-4f85-9ac5-f3da5b19bd2f
      const response = await fetch(
        `${webserver.origin}/api/v1/projects/766d50d5-c8b8-4f85-9ac5-f3da5b19bd2f`,
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
    test("A member can read the project", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const session = await orchestrator.createSession(activatedOwner);
      const createdProject = await orchestrator.createProject({
        created_by: activatedOwner.id,
        name: "Projeto do membro",
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${createdProject.id}`,
        {
          headers: {
            Cookie: `session_id=${session.token}`,
          },
        },
      );

      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: createdProject.id,
        name: createdProject.name,
        created_by: createdProject.created_by,
        created_at: createdProject.created_at.toISOString(),
        updated_at: createdProject.updated_at.toISOString(),
      });
      expect(uuidVersion(responseBody.id)).toBe(4);
    });

    test("A non-member cannot read the project", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const createdProject = await orchestrator.createProject({
        created_by: activatedOwner.id,
      });

      const outsider = await orchestrator.createUser();
      const activatedOutsider = await orchestrator.activateUser(outsider);
      const session = await orchestrator.createSession(activatedOutsider);

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${createdProject.id}`,
        {
          headers: {
            Cookie: `session_id=${session.token}`,
          },
        },
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        name: "ForbiddenError",
        message: "Você não é membro deste projeto.",
        action: "Solicite acesso ao proprietário do projeto.",
        status_code: 403,
      });
    });
  });
});

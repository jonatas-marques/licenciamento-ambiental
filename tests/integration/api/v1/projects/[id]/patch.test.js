// import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("PATCH /api/v1/projects/[id]", () => {
  describe("Anonymous user", () => {
    test("Cannot update a project", async () => {
      const createdProject = await orchestrator.createProject();

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${createdProject.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "A Project Name",
          }),
        },
      );

      expect(response.status).toBe(403);
    });
  });

  describe("Default user", () => {
    test("With unique name", async () => {
      const createdUser = await orchestrator.createUser();
      const activatedUser = await orchestrator.activateUser(createdUser);
      const sessionObject = await orchestrator.createSession(activatedUser);

      const createdProject = await orchestrator.createProject({
        name: "Old Project Name",
        created_by: activatedUser.id,
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${createdProject.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObject.token}`,
          },
          body: JSON.stringify({
            name: "New Project Name",
          }),
        },
      );

      expect(response.status).toBe(200);
    });

    test("With unchanged name", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const session = await orchestrator.createSession(activatedOwner);
      const createdProject = await orchestrator.createProject({
        name: "Unchanged Project Name",
        created_by: activatedOwner.id,
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${createdProject.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({ name: createdProject.name }),
        },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(
        expect.objectContaining({ name: createdProject.name }),
      );
    });

    test("A project member without admin role cannot update a project", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const createdProject = await orchestrator.createProject({
        created_by: activatedOwner.id,
      });

      const member = await orchestrator.createUser();
      const activatedMember = await orchestrator.activateUser(member);
      await orchestrator.addMemberToProject(activatedOwner, {
        project_id: createdProject.id,
        user_id: activatedMember.id,
        role: "member",
      });
      const session = await orchestrator.createSession(activatedMember);

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${createdProject.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({ name: "Updated by member" }),
        },
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para atualizar esse projeto.",
        action:
          "Apenas owner ou admin do projeto podem atualizar os dados do projeto.",
        status_code: 403,
      });
    });

    test("A non-member cannot update a project", async () => {
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
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({ name: "Updated by outsider" }),
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

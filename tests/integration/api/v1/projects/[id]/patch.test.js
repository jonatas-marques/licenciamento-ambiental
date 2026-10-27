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

    test("An owner can archive a project", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const session = await orchestrator.createSession(activatedOwner);
      const createdProject = await orchestrator.createProject({
        name: "Project to archive",
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
          body: JSON.stringify({ status: "archived" }),
        },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          id: createdProject.id,
          status: "archived",
          updated_by: activatedOwner.id,
        }),
      );
    });

    test("An admin can update the project", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const createdProject = await orchestrator.createProject({
        name: "Project for admin update",
        created_by: activatedOwner.id,
      });

      const admin = await orchestrator.createUser();
      const activatedAdmin = await orchestrator.activateUser(admin);
      await orchestrator.addMemberToProject(activatedOwner, {
        project_id: createdProject.id,
        user_id: activatedAdmin.id,
        role: "admin",
      });
      const session = await orchestrator.createSession(activatedAdmin);

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${createdProject.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({ name: "Project updated by admin" }),
        },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          name: "Project updated by admin",
          updated_by: activatedAdmin.id,
        }),
      );
    });

    test("Rejects attempts to update server-managed fields", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const session = await orchestrator.createSession(activatedOwner);
      const createdProject = await orchestrator.createProject({
        name: "Project with protected audit fields",
        created_by: activatedOwner.id,
      });
      const otherUser = await orchestrator.createUser();

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${createdProject.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({
            name: "Modified project",
            created_by: otherUser.id,
          }),
        },
      );

      expect(response.status).toBe(400);
      const unchangedProject = await fetch(
        `${webserver.origin}/api/v1/projects/${createdProject.id}`,
        {
          headers: {
            Cookie: `session_id=${session.token}`,
          },
        },
      );
      expect((await unchangedProject.json()).name).toBe(createdProject.name);
    });

    test("A viewer cannot archive a project", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const createdProject = await orchestrator.createProject({
        created_by: activatedOwner.id,
      });

      const viewer = await orchestrator.createUser();
      const activatedViewer = await orchestrator.activateUser(viewer);
      await orchestrator.addMemberToProject(activatedOwner, {
        project_id: createdProject.id,
        user_id: activatedViewer.id,
        role: "viewer",
      });
      const session = await orchestrator.createSession(activatedViewer);

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${createdProject.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({ status: "archived" }),
        },
      );

      expect(response.status).toBe(403);
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

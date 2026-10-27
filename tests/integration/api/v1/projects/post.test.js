import { version as uuidVersion } from "uuid";
import database from "infra/database.js";
import project from "models/project.js";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/projects", () => {
  describe("Anonymous user", () => {
    test("With valid data", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Empreendimento Teste Ltda",
        }),
      });

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
    test("With unique `name`", async () => {
      const user = await orchestrator.createUser();
      const activatedUser = await orchestrator.activateUser(user);
      const userSessionObject = await orchestrator.createSession(activatedUser);

      const response = await fetch(`${webserver.origin}/api/v1/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${userSessionObject.token}`,
        },
        body: JSON.stringify({
          name: "Unique Project Name",
        }),
      });

      expect(response.status).toBe(201);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        name: "Unique Project Name",
        created_by: user.id,
        updated_by: user.id,
        status: "active",
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      const ownerMembership = await project.getMembership(
        responseBody.id,
        activatedUser,
      );
      expect(ownerMembership).toEqual(
        expect.objectContaining({
          project_id: responseBody.id,
          user_id: activatedUser.id,
          role: "owner",
        }),
      );

      const listResponse = await fetch(`${webserver.origin}/api/v1/projects`, {
        headers: {
          Cookie: `session_id=${userSessionObject.token}`,
        },
      });
      expect(listResponse.status).toBe(200);
      expect(await listResponse.json()).toEqual([
        expect.objectContaining({ id: responseBody.id }),
      ]);
    });

    test("With duplicated `name`", async () => {
      const user = await orchestrator.createUser();
      await orchestrator.activateUser(user);
      const userSessionObject = await orchestrator.createSession(user);

      const response1 = await fetch(`${webserver.origin}/api/v1/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${userSessionObject.token}`,
        },
        body: JSON.stringify({
          name: "Same Name Project",
        }),
      });

      expect(response1.status).toBe(201);

      const response2 = await fetch(`${webserver.origin}/api/v1/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${userSessionObject.token}`,
        },
        body: JSON.stringify({
          name: "Same Name Project",
        }),
      });

      expect(response2.status).toBe(400);

      const responseBody2 = await response2.json();
      expect(responseBody2).toEqual({
        name: "ValidationError",
        message: "Nome já está em uso.",
        action: "Utilize outro nome para realizar esta operação.",
        status_code: 400,
      });
    });

    test("Rejects empty names and attempts to set server-managed fields", async () => {
      const user = await orchestrator.createUser();
      const activatedUser = await orchestrator.activateUser(user);
      const session = await orchestrator.createSession(activatedUser);
      const otherUser = await orchestrator.createUser();

      const invalidNameResponse = await fetch(
        `${webserver.origin}/api/v1/projects`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({ name: "   " }),
        },
      );
      expect(invalidNameResponse.status).toBe(400);

      const massAssignmentResponse = await fetch(
        `${webserver.origin}/api/v1/projects`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({
            name: "Project with rejected creator",
            created_by: otherUser.id,
          }),
        },
      );
      expect(massAssignmentResponse.status).toBe(400);

      const projects = await database.query({
        text: "SELECT id FROM projects WHERE name = $1;",
        values: ["Project with rejected creator"],
      });
      expect(projects.rowCount).toBe(0);
    });

    test("Rolls back project creation when owner membership insertion fails", async () => {
      const user = await orchestrator.createUser();
      const activatedUser = await orchestrator.activateUser(user);
      const session = await orchestrator.createSession(activatedUser);
      const projectName = "Project whose owner insert fails";

      await database.query(`
        CREATE FUNCTION reject_project_owner_insert()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF NEW.role = 'owner' THEN
            RAISE EXCEPTION 'Test-only owner insert failure';
          END IF;
          RETURN NEW;
        END;
        $$;
        CREATE TRIGGER reject_project_owner_insert
        BEFORE INSERT ON project_members
        FOR EACH ROW
        EXECUTE FUNCTION reject_project_owner_insert();
      `);

      try {
        const response = await fetch(`${webserver.origin}/api/v1/projects`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({ name: projectName }),
        });

        expect(response.status).toBe(500);

        const projects = await database.query({
          text: "SELECT id FROM projects WHERE name = $1;",
          values: [projectName],
        });
        expect(projects.rowCount).toBe(0);
      } finally {
        await database.query(`
          DROP TRIGGER reject_project_owner_insert ON project_members;
          DROP FUNCTION reject_project_owner_insert();
        `);
      }
    });
  });
});

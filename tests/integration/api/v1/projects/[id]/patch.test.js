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
  });
});

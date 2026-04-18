import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/persons/relations", () => {
  describe("Anonymous user", () => {
    test("With valid data", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/persons/relations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            person_id: "00000000-0000-0000-0000-000000000001",
            related_person_id: "00000000-0000-0000-0000-000000000002",
            relation: "Procuração",
            valid_from: "2024-01-01T00:00:00Z",
            valid_to: "2024-12-31T23:59:59Z",
          }),
        },
      );

      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action:
          'Verifique se o seu usuário possui a feature "create:person_relation".',
        status_code: 403,
      });
    });
  });
});

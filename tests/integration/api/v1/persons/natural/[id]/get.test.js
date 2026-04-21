import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/persons/natural/[id]", () => {
  describe("Anonymous user", () => {
    test("With valid `id`", async () => {
      const naturalPerson = await orchestrator.createNaturalPerson();

      const response = await fetch(
        `${webserver.origin}/api/v1/persons/natural/${naturalPerson.id}`,
      );

      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        cpf: responseBody.cpf,
        name: responseBody.name,
        created_by: responseBody.created_by,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
    });

    test("With nonexistent `id`", async () => {
      // Random ID: 766d50d5-c8b8-4f85-9ac5-f3da5b19bd2f
      const response = await fetch(
        `${webserver.origin}/api/v1/persons/natural/766d50d5-c8b8-4f85-9ac5-f3da5b19bd2f`,
      );

      expect(response.status).toBe(404);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "NotFoundError",
        message: "Pessoa física não encontrada.",
        action: "Verifique o ID da pessoa física informado.",
        status_code: 404,
      });
    });
  });
});

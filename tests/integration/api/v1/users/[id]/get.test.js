import orchestrator from "tests/orchestrator.js";
import { version as uuidVersion } from "uuid";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/users/[id]", () => {
  describe("Annonymous user", () => {
    test("With existent `id`", async () => {
      const createdUser = await orchestrator.createUser({
        cpf: "11122233344",
        email: "createduser@mail.com",
        password: "senha123",
      });

      const response2 = await fetch(
        `${webserver.origin}/api/v1/users/${createdUser.id}`,
      );
      expect(response2.status).toBe(200);

      const response2Body = await response2.json();

      expect(response2Body).toEqual({
        id: createdUser.id,
        features: ["read:activation_token"],
        created_at: response2Body.created_at,
        updated_at: response2Body.updated_at,
      });

      expect(uuidVersion(response2Body.id)).toBe(4);
      expect(Date.parse(response2Body.created_at)).not.toBeNaN();
      expect(Date.parse(response2Body.updated_at)).not.toBeNaN();

      expect(response2Body).not.toHaveProperty("cpf");
      expect(response2Body).not.toHaveProperty("email");
      expect(response2Body).not.toHaveProperty("password");
    });

    test("With nonexistent `id`", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/users/530257eb-b37c-40a0-9e90-c66cce482faf`,
      );

      expect(response.status).toBe(404);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "NotFoundError",
        message: "ID não encontrado.",
        action: "Verifique o ID do usuário informado.",
        status_code: 404,
      });
    });
  });
});

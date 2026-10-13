import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/profile", () => {
  describe("Anonymous user", () => {
    test("Retrieving the endpoint", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/profile`);

      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action: 'Verifique se o seu usuário possui a feature "read:profile".',
        status_code: 403,
      });
    });
  });
  describe("Default user", () => {
    test("With existent and not linked person", async () => {
      // Create a person without user_id
      const createdPerson = await orchestrator.createNaturalPerson({
        cpf: "11122233344",
        name: "Nome da Pessoa",
      });
      const createdUser = await orchestrator.createUser({
        cpf: "11122233344",
      });

      const activatedUser = await orchestrator.activateUser(createdUser);

      const sessionObject = await orchestrator.createSession(activatedUser);

      const response = await fetch(`${webserver.origin}/api/v1/profile`, {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });

      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        user: {
          id: responseBody.user.id,
          cpf: "11122233344",
          email: responseBody.user.email,
          password: responseBody.user.password,
          created_at: responseBody.user.created_at,
          updated_at: responseBody.user.updated_at,
          features: responseBody.user.features,
        },
        person: {
          id: createdPerson.id,
          user_id: null,
          cpf: "11122233344",
          name: "Nome da Pessoa",
          created_at: createdPerson.created_at.toISOString(),
          created_by: createdPerson.created_by,
          updated_at: createdPerson.updated_at.toISOString(),
        },
      });
    });

    test("With nonexistent person", async () => {
      const createdUser = await orchestrator.createUser({
        cpf: "11122233377",
      });

      const activatedUser = await orchestrator.activateUser(createdUser);

      const sessionObject = await orchestrator.createSession(activatedUser);

      const response = await fetch(`${webserver.origin}/api/v1/profile`, {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });

      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        user: {
          id: responseBody.user.id,
          cpf: "11122233377",
          email: responseBody.user.email,
          password: responseBody.user.password,
          created_at: responseBody.user.created_at,
          updated_at: responseBody.user.updated_at,
          features: responseBody.user.features,
        },
        person: null,
      });
    });
  });
});

import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/persons/natural", () => {
  describe("Anonymous user", () => {
    test("Creating new person", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/persons/natural`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Fulano de Tal",
            mother_name: "Beltrana de Tal",
            birth_date: "1990-01-01",
            cpf: "03819247812",
          }),
        },
      );

      expect(response.status).toBe(403);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action: 'Verifique se o seu usuário possui a feature "create:person".',
        status_code: 403,
      });
    });
  });

  describe("Default user", () => {
    test("With valid data", async () => {
      const user = await orchestrator.createUser();
      const activatedUser = await orchestrator.activateUser(user);
      const userSessionObject = await orchestrator.createSession(activatedUser);

      const response = await fetch(
        `${webserver.origin}/api/v1/persons/natural`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${userSessionObject.token}`,
          },
          body: JSON.stringify({
            name: "Fulano de Tal",
            mother_name: "Beltrana de Tal",
            birth_date: "1990-01-01",
            cpf: "03819247812",
          }),
        },
      );

      expect(response.status).toBe(201);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        type: responseBody.type,
        name: "Fulano de Tal",
        created_by: user.id,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
        cpf: "03819247812",
        birth_date: "1990-01-01T00:00:00.000Z", // ISO string format
        mother_name: "Beltrana de Tal",
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
    });

    test("With duplicated `CPF`", async () => {
      const user = await orchestrator.createUser();
      await orchestrator.activateUser(user);
      const userSessionObject = await orchestrator.createSession(user);

      const response1 = await fetch(
        `${webserver.origin}/api/v1/persons/natural`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${userSessionObject.token}`,
          },
          body: JSON.stringify({
            name: "Nome da Pessoa 1",
            mother_name: "Nome da Mãe da Pessoa 1",
            birth_date: "1990-01-01",
            cpf: "00000000001",
          }),
        },
      );

      expect(response1.status).toBe(201);

      const response2 = await fetch(
        `${webserver.origin}/api/v1/persons/natural`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${userSessionObject.token}`,
          },
          body: JSON.stringify({
            name: "Nome da Pessoa 2",
            mother_name: "Nome da Mãe da Pessoa 2",
            birth_date: "1990-01-01",
            cpf: "00000000001", // Mesmo CPF do primeiro cadastro
            created_by: user.id,
          }),
        },
      );

      expect(response2.status).toBe(400);

      const responseBody2 = await response2.json();
      expect(responseBody2).toEqual({
        name: "ValidationError",
        message: "CPF já está em uso.",
        action: "Utilize outro CPF para realizar esta operação.",
        status_code: 400,
      });
    });
  });
});

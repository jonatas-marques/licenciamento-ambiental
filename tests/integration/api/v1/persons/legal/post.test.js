import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import person from "models/person.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/persons/legal", () => {
  describe("Anonymous user", () => {
    test("With valid data", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/persons/legal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Empresa Teste Ltda",
          cnpj: "12345678000123",
        }),
      });

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
      const naturalPerson = await person.createNaturalPerson({
        name: "Pessoa responsável pela empresa",
        cpf: activatedUser.cpf,
        created_by: activatedUser.id,
        user_id: activatedUser.id,
      });

      const response = await fetch(`${webserver.origin}/api/v1/persons/legal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${userSessionObject.token}`,
        },
        body: JSON.stringify({
          name: "Empresa Teste Ltda",
          cnpj: "12345678000123",
        }),
      });

      expect(response.status).toBe(201);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      const memberships = await person.listLegalPersonMembers(responseBody.id);

      expect(memberships).toEqual([
        expect.objectContaining({
          legal_person_id: responseBody.id,
          natural_person_id: naturalPerson.id,
          role: "socio",
        }),
      ]);

      const listResponse = await fetch(
        `${webserver.origin}/api/v1/persons/legal`,
        {
          headers: {
            Cookie: `session_id=${userSessionObject.token}`,
          },
        },
      );

      expect(listResponse.status).toBe(200);
      expect(await listResponse.json()).toEqual([
        expect.objectContaining({ id: responseBody.id }),
      ]);
    });

    test("With duplicated `CNPJ`", async () => {
      const user = await orchestrator.createUser();
      const activatedUser = await orchestrator.activateUser(user);
      const userSessionObject = await orchestrator.createSession(user);
      await person.createNaturalPerson({
        name: "Pessoa responsável pela empresa",
        cpf: activatedUser.cpf,
        created_by: activatedUser.id,
        user_id: activatedUser.id,
      });

      const response1 = await fetch(
        `${webserver.origin}/api/v1/persons/legal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${userSessionObject.token}`,
          },
          body: JSON.stringify({
            name: "Empresa 1 Ltda",
            cnpj: "00000000000001",
          }),
        },
      );

      expect(response1.status).toBe(201);

      const response2 = await fetch(
        `${webserver.origin}/api/v1/persons/legal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${userSessionObject.token}`,
          },
          body: JSON.stringify({
            name: "Empresa 2 Ltda",
            cnpj: "00000000000001", // Mesmo CNPJ do primeiro cadastro
          }),
        },
      );

      expect(response2.status).toBe(400);

      const responseBody2 = await response2.json();
      expect(responseBody2).toEqual({
        name: "ValidationError",
        message: "CNPJ já está em uso.",
        action: "Utilize outro CNPJ para realizar esta operação.",
        status_code: 400,
      });
    });
  });
});

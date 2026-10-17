import orchestrator from "tests/orchestrator.js";
import { version as uuidVersion } from "uuid";
import person from "models/person.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/person", () => {
  describe("Anonymous user", () => {
    test("Retrieving the endpoint", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/person`);

      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action: 'Verifique se o seu usuário possui a feature "read:person".',
        status_code: 403,
      });
    });
  });
  describe("Default user", () => {
    describe("Person lookup", () => {
      test("With person linked by user_id", async () => {
        const createdUser = await orchestrator.createUser({
          cpf: "11122233344",
        });

        const activatedUser = await orchestrator.activateUser(createdUser);

        const sessionObject = await orchestrator.createSession(activatedUser);

        const createdPerson = await orchestrator.createNaturalPerson({
          cpf: createdUser.cpf,
          name: "John Doe",
        });

        const linkedPerson = await person.linkUser(
          createdPerson.id,
          activatedUser.id,
        );

        const response = await fetch(`${webserver.origin}/api/v1/person`, {
          headers: {
            Cookie: `session_id=${sessionObject.token}`,
          },
        });

        expect(response.status).toBe(200);

        const cacheControl = response.headers.get("Cache-Control");

        expect(cacheControl).toBe(
          "no-store, no-cache, max-age=0, must-revalidate",
        );

        const responseBody = await response.json();

        expect(responseBody).toEqual({
          id: linkedPerson.id,
          cpf: linkedPerson.cpf,
          name: linkedPerson.name,
          user_id: activatedUser.id,
          created_by: linkedPerson.created_by,
          created_at: linkedPerson.created_at.toISOString(),
          updated_at: linkedPerson.updated_at.toISOString(),
        });

        expect(uuidVersion(responseBody.id)).toBe(4);
        expect(Date.parse(responseBody.created_at)).not.toBeNaN();
        expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
      });

      test("With person found by same CPF and user_id null", async () => {
        const createdUser = await orchestrator.createUser({
          cpf: "12122233344",
        });

        const activatedUser = await orchestrator.activateUser(createdUser);

        const sessionObject = await orchestrator.createSession(activatedUser);

        const createdPerson = await orchestrator.createNaturalPerson({
          cpf: createdUser.cpf,
        });

        expect(createdPerson.user_id).toBeNull();

        const response = await fetch(`${webserver.origin}/api/v1/person`, {
          headers: {
            Cookie: `session_id=${sessionObject.token}`,
          },
        });

        expect(response.status).toBe(200);

        const cacheControl = response.headers.get("Cache-Control");

        expect(cacheControl).toBe(
          "no-store, no-cache, max-age=0, must-revalidate",
        );

        const responseBody = await response.json();

        expect(responseBody).toEqual({
          id: createdPerson.id,
          cpf: createdPerson.cpf,
          name: createdPerson.name,
          user_id: null,
          created_by: createdPerson.created_by,
          created_at: createdPerson.created_at.toISOString(),
          updated_at: createdPerson.updated_at.toISOString(),
        });
      });

      test("With nonexistent person", async () => {
        const createdUser = await orchestrator.createUser({
          cpf: "12013033344",
        });

        const activatedUser = await orchestrator.activateUser(createdUser);

        const sessionObject = await orchestrator.createSession(activatedUser);

        const response = await fetch(`${webserver.origin}/api/v1/person`, {
          headers: {
            Cookie: `session_id=${sessionObject.token}`,
          },
        });

        expect(response.status).toBe(404);

        const cacheControl = response.headers.get("Cache-Control");

        expect(cacheControl).toBeNull();

        const responseBody = await response.json();

        expect(responseBody).toEqual({
          name: "NotFoundError",
          message: "Pessoa física não encontrada.",
          action: "Verifique o CPF informado.",
          status_code: 404,
        });
      });
    });

    describe("Data consistency", () => {
      test("With person linked by user_id but different CPF", async () => {
        const createdUser = await orchestrator.createUser({
          cpf: "01022233344",
        });

        const activatedUser = await orchestrator.activateUser(createdUser);

        const sessionObject = await orchestrator.createSession(activatedUser);

        const createdPerson = await orchestrator.createNaturalPerson({
          cpf: "13012312399",
          name: "Matheus Crood",
        });

        const linkedPerson = await person.linkUser(
          createdPerson.id,
          activatedUser.id,
        );

        // Confirma que montamos corretamente o cenário de inconsistência.
        expect(linkedPerson.user_id).toBe(activatedUser.id);
        expect(linkedPerson.cpf).not.toBe(activatedUser.cpf);

        const response = await fetch(`${webserver.origin}/api/v1/person`, {
          headers: {
            Cookie: `session_id=${sessionObject.token}`,
          },
        });

        expect(response.status).toBe(409);

        const cacheControl = response.headers.get("Cache-Control");

        expect(cacheControl).toBeNull();

        const responseBody = await response.json();

        expect(responseBody).toEqual({
          name: "ConflictError",
          message: "Não foi possível consultar os dados solicitados.",
          action: "Entre em contato com o suporte.",
          status_code: 409,
        });
      });
      test("With same CPF but linked to another user", async () => {
        // Create 1st user
        const createdUser1 = await orchestrator.createUser({
          cpf: "11122200041",
        });
        const activatedUser1 = await orchestrator.activateUser(createdUser1);

        const sessionObject = await orchestrator.createSession(activatedUser1);

        // Create 2nd user
        const createdUser2 = await orchestrator.createUser({
          cpf: "11122200042",
        });

        // Creates person with the same CPF from 1st user
        const createdPerson = await orchestrator.createNaturalPerson({
          cpf: createdUser1.cpf,
          name: "John Deer",
        });

        // But the person is linked to the 2nd user
        const linkedPerson = await person.linkUser(
          createdPerson.id,
          createdUser2.id,
        );

        // Check the inconsistency
        expect(linkedPerson.cpf).toBe(activatedUser1.cpf);
        expect(linkedPerson.user_id).toBe(createdUser2.id);
        expect(linkedPerson.user_id).not.toBe(createdUser1.id);

        const response = await fetch(`${webserver.origin}/api/v1/person`, {
          headers: {
            Cookie: `session_id=${sessionObject.token}`,
          },
        });

        expect(response.status).toBe(409);

        const cacheControl = response.headers.get("Cache-Control");

        expect(cacheControl).toBeNull();

        const responseBody = await response.json();

        expect(responseBody).toEqual({
          name: "ConflictError",
          message: "Não foi possível consultar os dados solicitados.",
          action: "Entre em contato com o suporte.",
          status_code: 409,
        });
      });
    });
  });
});

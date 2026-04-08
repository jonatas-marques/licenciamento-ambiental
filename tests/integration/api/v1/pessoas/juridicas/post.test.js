import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/pessoas/juridicas", () => {
  describe("Default user", () => {
    test("With valid data", async () => {
      const user = await orchestrator.createUser();
      await orchestrator.activateUser(user);
      const userSessionObject = await orchestrator.createSession(user);

      const response = await fetch(
        `${webserver.origin}/api/v1/pessoas/juridicas`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${userSessionObject.token}`,
          },
          body: JSON.stringify({
            nome: "Empresa Teste Ltda",
            cnpj: "12345678000123",
            criado_por: user.id,
          }),
        },
      );

      expect(response.status).toBe(201);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        tipo: "pessoa jurídica",
        nome: "Empresa Teste Ltda",
        criado_por: user.id,
        criado_em: responseBody.criado_em,
        atualizado_em: responseBody.atualizado_em,
        cnpj: "12345678000123",
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.criado_em)).not.toBeNaN();
      expect(Date.parse(responseBody.atualizado_em)).not.toBeNaN();
    });

    test("With duplicated `CNPJ`", async () => {
      const user = await orchestrator.createUser();
      await orchestrator.activateUser(user);
      const userSessionObject = await orchestrator.createSession(user);

      const response1 = await fetch(
        `${webserver.origin}/api/v1/pessoas/juridicas`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${userSessionObject.token}`,
          },
          body: JSON.stringify({
            nome: "Empresa 1 Ltda",
            cnpj: "00000000000001",
            criado_por: user.id,
          }),
        },
      );

      expect(response1.status).toBe(201);

      const response2 = await fetch(
        `${webserver.origin}/api/v1/pessoas/juridicas`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${userSessionObject.token}`,
          },
          body: JSON.stringify({
            nome: "Empresa 2 Ltda",
            cnpj: "00000000000001", // Mesmo CNPJ do primeiro cadastro
            criado_por: user.id,
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

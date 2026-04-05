import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/pessoas", () => {
  describe("Default user", () => {
    test("Criar pessoa física", async () => {
      const user = await orchestrator.createUser();
      await orchestrator.activateUser(user);
      const userSessionObject = await orchestrator.createSession(user);

      const response = await fetch(`${webserver.origin}/api/v1/pessoas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${userSessionObject.token}`,
        },
        body: JSON.stringify({
          tipo: "pessoa física",
          nome: "Fulano de Tal",
          cpf: "03819247812",
          criado_por: user.id,
        }),
      });

      expect(response.status).toBe(201);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        novaPessoa: {
          id: responseBody.novaPessoa.id,
          tipo: "pessoa física",
          nome: "Fulano de Tal",
          criado_por: user.id,
          criado_em: responseBody.novaPessoa.criado_em,
          atualizado_em: responseBody.novaPessoa.atualizado_em,
        },
        novaPessoaFisica: {
          id: responseBody.novaPessoaFisica.id,
          cpf: "03819247812",
          criado_em: responseBody.novaPessoaFisica.criado_em,
          atualizado_em: responseBody.novaPessoaFisica.atualizado_em,
          data_nascimento: null,
          nome_mae: null,
        },
        novaPessoaJuridica: null,
      });

      expect(uuidVersion(responseBody.novaPessoa.id)).toBe(4);
      expect(Date.parse(responseBody.novaPessoa.criado_em)).not.toBeNaN();
      expect(Date.parse(responseBody.novaPessoa.atualizado_em)).not.toBeNaN();
    });
  });
});

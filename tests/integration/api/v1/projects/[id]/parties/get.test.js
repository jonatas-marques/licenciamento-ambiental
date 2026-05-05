import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import party from "models/party.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/projects/[id]/parties", () => {
  describe("Anonymous user", () => {
    test("Cannot list parties", async () => {
      const project = await orchestrator.createProject();
      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${project.id}/parties`,
      );

      expect(response.status).toBe(403);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action: 'Verifique se o seu usuário possui a feature "read:project".',
        status_code: 403,
      });
    });
  });

  describe("Authenticated user", () => {
    test("Non-member cannot list parties", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const project = await orchestrator.createProject({
        created_by: activatedOwner.id,
      });

      const outsider = await orchestrator.createUser();
      const activatedOutsider = await orchestrator.activateUser(outsider);
      const outsiderSession =
        await orchestrator.createSession(activatedOutsider);

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${project.id}/parties`,
        { headers: { Cookie: `session_id=${outsiderSession.token}` } },
      );

      expect(response.status).toBe(403);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não é membro deste projeto.",
        action: "Solicite acesso ao proprietário do projeto.",
        status_code: 403,
      });
    });

    test("Owner can list parties", async () => {
      const owner = await orchestrator.createUser();
      const activatedOwner = await orchestrator.activateUser(owner);
      const ownerSession = await orchestrator.createSession(activatedOwner);

      const project = await orchestrator.createProject({
        created_by: activatedOwner.id,
      });

      const natural = await orchestrator.createNaturalPerson();
      await party.addParty(activatedOwner, project.id, {
        person_cp: natural.cpf,
        interest: "interessado",
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/projects/${project.id}/parties`,
        { headers: { Cookie: `session_id=${ownerSession.token}` } },
      );

      expect(response.status).toBe(200);
      const responseBody = await response.json();

      expect(Array.isArray(responseBody)).toBe(true);
      expect(responseBody).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            project_id: project.id,
            person_cp: natural.cpf,
            interest: "interessado",
          }),
        ]),
      );
    });
  });
});

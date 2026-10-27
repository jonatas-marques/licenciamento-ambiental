// import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import person from "models/person.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("PATCH /api/v1/persons/legal/[id]", () => {
  describe("Anonymous user", () => {
    test("Cannot update a legal person", async () => {
      const createdLegalPerson = await orchestrator.createLegalPerson();

      const response = await fetch(
        `${webserver.origin}/api/v1/persons/legal/${createdLegalPerson.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Unique Legal Person Name",
          }),
        },
      );

      expect(response.status).toBe(403);
    });
  });

  describe("Organization creator", () => {
    test("Can update an organization and save unchanged values", async () => {
      const createdUser = await orchestrator.createUser();
      const activatedUser = await orchestrator.activateUser(createdUser);
      const session = await orchestrator.createSession(activatedUser);
      const naturalPerson = await orchestrator.createNaturalPerson({
        cpf: activatedUser.cpf,
        created_by: activatedUser.id,
      });
      const createdLegalPerson = await orchestrator.createLegalPerson({
        created_by: activatedUser.id,
      });
      await person.addLegalPersonMember({
        legal_person_id: createdLegalPerson.id,
        natural_person_id: naturalPerson.id,
        role: "socio",
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/persons/legal/${createdLegalPerson.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({
            name: createdLegalPerson.name,
            cnpj: createdLegalPerson.cnpj,
          }),
        },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          id: createdLegalPerson.id,
          name: createdLegalPerson.name,
          cnpj: createdLegalPerson.cnpj,
        }),
      );
    });
  });
});

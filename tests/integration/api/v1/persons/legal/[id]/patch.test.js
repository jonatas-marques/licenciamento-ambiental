// import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

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
});

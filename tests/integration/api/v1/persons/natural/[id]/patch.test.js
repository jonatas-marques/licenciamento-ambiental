// import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("PATCH /api/v1/persons/natural/[id]", () => {
  describe("Anonymous user", () => {
    test("Cannot update a natural person", async () => {
      const createdNaturalPerson = await orchestrator.createNaturalPerson();

      const response = await fetch(
        `${webserver.origin}/api/v1/persons/natural/${createdNaturalPerson.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Unique Natural Person Name",
          }),
        },
      );

      expect(response.status).toBe(403);
    });
  });
});

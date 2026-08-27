import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/persons/legal/[id]/members", () => {
  test("Lists members", async () => {
    const legal = await orchestrator.createLegalPerson();
    const natural = await orchestrator.createNaturalPerson();

    // cria vínculo via model diretamente (para preparar o cenário)
    await (
      await import("models/person.js")
    ).default.addLegalPersonMember({
      legal_person_id: legal.id,
      natural_person_id: natural.id,
      role: "socio",
    });

    const response = await fetch(
      `${webserver.origin}/api/v1/persons/legal/${legal.id}/members`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          legal_person_id: legal.id,
          natural_person_id: natural.id,
          role: "socio",
        }),
      ]),
    );
  });
});

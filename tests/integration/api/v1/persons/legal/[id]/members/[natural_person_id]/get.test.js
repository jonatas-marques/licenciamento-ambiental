import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import person from "models/person.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/persons/legal/[id]/members/[natural_person_id]", () => {
  test("With existent membership", async () => {
    const legal = await orchestrator.createLegalPerson();
    const natural = await orchestrator.createNaturalPerson();

    await person.addLegalPersonMember({
      legal_person_id: legal.id,
      natural_person_id: natural.id,
      role: "socio",
    });

    const response = await fetch(
      `${webserver.origin}/api/v1/persons/legal/${legal.id}/members/${natural.id}`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        id: body.id,
        legal_person_id: legal.id,
        natural_person_id: natural.id,
        role: "socio",
        valid_from: body.valid_from,
        valid_to: body.valid_to,
      }),
    );

    expect(uuidVersion(body.id)).toBe(4);
    expect(Date.parse(body.valid_from)).not.toBeNaN();
  });

  test("With nonexistent membership returns 404", async () => {
    const legal = await orchestrator.createLegalPerson();
    const natural = await orchestrator.createNaturalPerson();

    const response = await fetch(
      `${webserver.origin}/api/v1/persons/legal/${legal.id}/members/${natural.id}`,
    );

    expect(response.status).toBe(404);
    const body = await response.json();

    expect(body).toEqual({
      name: "NotFoundError",
      message: "Vínculo não encontrado.",
      action: "Verifique os IDs informados.",
      status_code: 404,
    });
  });
});

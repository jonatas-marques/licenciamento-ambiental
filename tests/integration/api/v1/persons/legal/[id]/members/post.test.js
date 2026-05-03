import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/persons/legal/[id]/members", () => {
  test("Anonymous user cannot add member", async () => {
    const legal = await orchestrator.createLegalPerson();
    const natural = await orchestrator.createNaturalPerson();

    const response = await fetch(
      `${webserver.origin}/api/v1/persons/legal/${legal.id}/members`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          natural_person_id: natural.id,
          role: "socio",
        }),
      },
    );

    expect(response.status).toBe(403);
  });

  test("User with update:person can add member", async () => {
    const legal = await orchestrator.createLegalPerson();
    const natural = await orchestrator.createNaturalPerson();

    const user = await orchestrator.createUser();
    const activated = await orchestrator.activateUser(user);
    await orchestrator.addFeaturesToUser(activated, ["update:person"]);
    const session = await orchestrator.createSession(activated);

    const response = await fetch(
      `${webserver.origin}/api/v1/persons/legal/${legal.id}/members`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({
          natural_person_id: natural.id,
          role: "socio",
        }),
      },
    );

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        legal_person_id: legal.id,
        natural_person_id: natural.id,
        role: "socio",
      }),
    );
  });
});

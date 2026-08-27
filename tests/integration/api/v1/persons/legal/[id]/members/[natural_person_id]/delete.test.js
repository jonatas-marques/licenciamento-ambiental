import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import person from "models/person.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("DELETE /api/v1/persons/legal/[id]/members/[natural_person_id]", () => {
  test("User with update:person can delete membership", async () => {
    const legal = await orchestrator.createLegalPerson();
    const natural = await orchestrator.createNaturalPerson();

    await person.addLegalPersonMember({
      legal_person_id: legal.id,
      natural_person_id: natural.id,
      role: "socio",
    });

    const user = await orchestrator.createUser();
    const activated = await orchestrator.activateUser(user);
    await orchestrator.addFeaturesToUser(activated, ["update:person"]);
    const session = await orchestrator.createSession(activated);

    const response = await fetch(
      `${webserver.origin}/api/v1/persons/legal/${legal.id}/members/${natural.id}`,
      {
        method: "DELETE",
        headers: { Cookie: `session_id=${session.token}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        legal_person_id: legal.id,
        natural_person_id: natural.id,
      }),
    );
  });
});

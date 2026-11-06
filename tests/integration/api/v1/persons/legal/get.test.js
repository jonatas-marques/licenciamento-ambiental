import database from "infra/database.js";
import orchestrator from "tests/orchestrator.js";
import person from "models/person.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/persons/legal", () => {
  test("Anonymous user cannot list legal persons", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/persons/legal`);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      name: "ForbiddenError",
      message: "Você não possui permissão para executar esta ação.",
      action: 'Verifique se o seu usuário possui a feature "read:project".',
      status_code: 403,
    });
  });

  test("Lists only legal persons where the user is an active member", async () => {
    const user = await orchestrator.createUser();
    const activatedUser = await orchestrator.activateUser(user);
    const session = await orchestrator.createSession(activatedUser);

    const naturalPerson = await person.createNaturalPerson({
      name: "Pessoa usuária",
      cpf: activatedUser.cpf,
      created_by: activatedUser.id,
      user_id: activatedUser.id,
    });

    const ownLegalPerson = await orchestrator.createLegalPerson({
      name: "Organização da pessoa usuária",
    });
    await person.addLegalPersonMember({
      legal_person_id: ownLegalPerson.id,
      natural_person_id: naturalPerson.id,
      role: "socio",
    });

    const expiredLegalPerson = await orchestrator.createLegalPerson({
      name: "Organização com vínculo expirado",
    });
    await database.query({
      text: `
        INSERT INTO legal_person_members (
          legal_person_id,
          natural_person_id,
          role,
          valid_from,
          valid_to
        )
        VALUES (
          $1,
          $2,
          'socio',
          timezone('utc', now()) - interval '2 days',
          timezone('utc', now()) - interval '1 day'
        );
      `,
      values: [expiredLegalPerson.id, naturalPerson.id],
    });

    const otherNaturalPerson = await orchestrator.createNaturalPerson();
    const otherLegalPerson = await orchestrator.createLegalPerson();
    await person.addLegalPersonMember({
      legal_person_id: otherLegalPerson.id,
      natural_person_id: otherNaturalPerson.id,
      role: "socio",
    });

    const createdButUnlinkedLegalPerson = await orchestrator.createLegalPerson({
      name: "Organização sem vínculo",
    });

    const response = await fetch(`${webserver.origin}/api/v1/persons/legal`, {
      headers: {
        Cookie: `session_id=${session.token}`,
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "no-store, no-cache, max-age=0, must-revalidate",
    );
    const responseBody = await response.json();

    expect(responseBody).toHaveLength(1);
    expect(responseBody[0]).toEqual(
      expect.objectContaining({
        id: ownLegalPerson.id,
        name: ownLegalPerson.name,
        cnpj: ownLegalPerson.cnpj,
      }),
    );
    expect(responseBody).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: createdButUnlinkedLegalPerson.id }),
      ]),
    );
  });

  test("Returns an empty list when the user has no linked natural person", async () => {
    const user = await orchestrator.createUser();
    const activatedUser = await orchestrator.activateUser(user);
    const session = await orchestrator.createSession(activatedUser);

    const response = await fetch(`${webserver.origin}/api/v1/persons/legal`, {
      headers: {
        Cookie: `session_id=${session.token}`,
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import person from "models/person.js";
import party from "models/party.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function createOwnedProject() {
  const owner = await orchestrator.activateUser(
    await orchestrator.createUser(),
  );
  const project = await orchestrator.createProject({ created_by: owner.id });
  return { owner, project };
}

async function createUserLinkedToNaturalPerson() {
  const user = await orchestrator.activateUser(await orchestrator.createUser());
  const natural = await orchestrator.createNaturalPerson();
  await person.linkUser(natural.id, user.id);
  const session = await orchestrator.createSession(user);
  return { user, natural, session };
}

function request(path, session, options = {}) {
  return fetch(`${webserver.origin}/api/v1/projects/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: `session_id=${session.token}`,
    },
  });
}

describe("Party based access", () => {
  test("Member of a legal person that is a legal responsible has full access", async () => {
    const { owner, project } = await createOwnedProject();
    const legal = await orchestrator.createLegalPerson();
    const { natural, session } = await createUserLinkedToNaturalPerson();
    await person.addLegalPersonMember({
      legal_person_id: legal.id,
      natural_person_id: natural.id,
      role: "sócio",
    });
    await party.addParty(owner, project.id, {
      person_id: legal.id,
      interest: "Responsável Legal",
    });

    const other = await orchestrator.createNaturalPerson();
    const response = await request(`${project.id}/parties`, session, {
      method: "POST",
      body: JSON.stringify({ person_id: other.id, interest: "interessado" }),
    });

    expect(response.status).toBe(201);
  });

  test("Natural person that is a consultancy has full access", async () => {
    const { owner, project } = await createOwnedProject();
    const { natural, session } = await createUserLinkedToNaturalPerson();
    await party.addParty(owner, project.id, {
      person_id: natural.id,
      interest: "consultoria ambiental",
    });

    const other = await orchestrator.createNaturalPerson();
    const response = await request(`${project.id}/parties`, session, {
      method: "POST",
      body: JSON.stringify({ person_id: other.id, interest: "interessado" }),
    });

    expect(response.status).toBe(201);
  });

  test("Other parties can only read", async () => {
    const { owner, project } = await createOwnedProject();
    const { natural, session } = await createUserLinkedToNaturalPerson();
    await party.addParty(owner, project.id, {
      person_id: natural.id,
      interest: "interessado",
    });

    const listResponse = await request(`${project.id}/parties`, session);
    expect(listResponse.status).toBe(200);

    const other = await orchestrator.createNaturalPerson();
    const postResponse = await request(`${project.id}/parties`, session, {
      method: "POST",
      body: JSON.stringify({ person_id: other.id, interest: "interessado" }),
    });
    expect(postResponse.status).toBe(403);
  });

  test("Former member of the legal person has no access", async () => {
    const { owner, project } = await createOwnedProject();
    const legal = await orchestrator.createLegalPerson();
    const { natural, session } = await createUserLinkedToNaturalPerson();
    await person.addLegalPersonMember({
      legal_person_id: legal.id,
      natural_person_id: natural.id,
      role: "sócio",
    });
    await person.removeLegalPersonMember(legal.id, natural.id);
    await party.addParty(owner, project.id, {
      person_id: legal.id,
      interest: "responsável legal",
    });

    const response = await request(`${project.id}/parties`, session);

    expect(response.status).toBe(403);
  });
});

describe("Legal responsible rules", () => {
  test("Cannot remove or demote the last legal responsible", async () => {
    const { owner, project } = await createOwnedProject();
    const natural = await orchestrator.createNaturalPerson();
    const created = await party.addParty(owner, project.id, {
      person_id: natural.id,
      interest: "responsável legal",
    });

    await expect(
      party.removeParty(owner, project.id, created.id),
    ).rejects.toMatchObject({
      message: "O projeto precisa de ao menos um responsável legal.",
    });
    await expect(
      party.updateParty(owner, project.id, created.id, {
        interest: "interessado",
      }),
    ).rejects.toMatchObject({
      message: "O projeto precisa de ao menos um responsável legal.",
    });
  });

  test("Can remove a legal responsible when another exists", async () => {
    const { owner, project } = await createOwnedProject();
    const first = await orchestrator.createNaturalPerson();
    const second = await orchestrator.createLegalPerson();
    const created = await party.addParty(owner, project.id, {
      person_id: first.id,
      interest: "responsável legal",
    });
    await party.addParty(owner, project.id, {
      person_id: second.id,
      interest: "responsável legal",
    });

    const removed = await party.removeParty(owner, project.id, created.id);

    expect(removed.id).toBe(created.id);
  });
});

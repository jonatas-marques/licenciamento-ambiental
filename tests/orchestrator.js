import database from "infra/database.js";
import retry from "async-retry";
import { fakerPT_BR as faker } from "@faker-js/faker";
import migrator from "models/migrator.js";
import user from "models/user.js";
import session from "models/session.js";
import activation from "models/activation";
import webserver from "infra/webserver.js";
import person from "models/person.js";

const emailHttpUrl = `http://${process.env.EMAIL_HTTP_HOST}:${process.env.EMAIL_HTTP_PORT}`;

//faker.setDefaultLocale("pt_BR");

async function waitForAllServices() {
  await waitForWebService();
  await waitForEmailService();

  async function waitForWebService() {
    return retry(fetchStatusPage, {
      retries: 100,
      maxTimeout: 1000,
    });

    async function fetchStatusPage() {
      const response = await fetch(`${webserver.origin}/api/v1/status`);

      if (response.status !== 200) {
        throw Error();
      }
    }
  }
  async function waitForEmailService() {
    return retry(fetchEmailPage, {
      retries: 100,
      maxTimeout: 1000,
    });

    async function fetchEmailPage() {
      const response = await fetch(emailHttpUrl);

      if (response.status !== 200) {
        throw Error();
      }
    }
  }
}

async function clearDatabase() {
  await database.query("drop schema public cascade; create schema public;");
}

async function runPendingMigrations() {
  await migrator.runPendingMigrations();
}

async function createUser(userObject) {
  return await user.create({
    cpf:
      userObject?.cpf || faker.string.numeric(11, { allowLeadingZeros: true }),
    email: userObject?.email || faker.internet.email(),
    password: userObject?.password || "validpassword",
  });
}

async function createSession(userObject) {
  return await session.create(userObject.id);
}

async function createNaturalPerson(personObject) {
  return await person.createNaturalPerson({
    name: personObject?.name || faker.person.fullName(),
    cpf: personObject?.cpf || faker.string.numeric(11),
    created_by: personObject?.created_by || faker.string.uuid(),
  });
}

async function createLegalPerson(personObject) {
  return await person.createLegalPerson({
    name: personObject?.name || faker.company.name().replace(/[_.-]/g, ""),
    cnpj: personObject?.cnpj || faker.string.numeric(14),
    created_by: personObject?.created_by || faker.string.uuid(),
  });
}

async function deleteAllEmails() {
  await fetch(`${emailHttpUrl}/messages`, {
    method: "DELETE",
  });
}

async function getLastEmail() {
  const emailListResponse = await fetch(`${emailHttpUrl}/messages`);
  const emailListBody = await emailListResponse.json();
  const lastEmailItem = emailListBody.pop();

  if (!lastEmailItem) {
    return null;
  }

  const emailTextResponse = await fetch(
    `${emailHttpUrl}/messages/${lastEmailItem.id}.plain`,
  );
  const emailTextBody = await emailTextResponse.text();

  lastEmailItem.text = emailTextBody;
  return lastEmailItem;
}

async function extractUUID(text) {
  const match = text.match(/[0-9a-fA-F-]{36}/);
  return match ? match[0] : null;
}

async function activateUser(inactiveUser) {
  return await activation.activateUserByUserId(inactiveUser.id);
}

async function addFeaturesToUser(userObject, features) {
  const updatedUser = await user.addFeatures(userObject.id, features);
  return updatedUser;
}

const orchestrator = {
  waitForAllServices,
  clearDatabase,
  runPendingMigrations,
  createUser,
  createSession,
  createNaturalPerson,
  createLegalPerson,
  deleteAllEmails,
  getLastEmail,
  extractUUID,
  activateUser,
  addFeaturesToUser,
};

export default orchestrator;

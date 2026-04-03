import email from "infra/email.js";
import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("infra/email.js", () => {
  test("send()", async () => {
    await orchestrator.deleteAllEmails();

    await email.send({
      from: "LicenciamentoAmbiental <contato@licenciamento-ambiental.dev.br>",
      to: "destinatario@mail.com",
      subject: "Teste de envio de email",
      text: "Teste de corpo.",
    });

    await email.send({
      from: "LicenciamentoAmbiental <contato@licenciamento-ambiental.dev.br>",
      to: "destinatario@mail.com",
      subject: "Último email enviado",
      text: "Corpo do último email.",
    });

    const lastEmail = await orchestrator.getLastEmail();
    expect(lastEmail.sender).toBe("<contato@licenciamento-ambiental.dev.br>");
    expect(lastEmail.recipients[0]).toBe("<destinatario@mail.com>");
    expect(lastEmail.subject).toBe("Último email enviado");
    expect(lastEmail.text).toBe("Corpo do último email.\r\n");
  });
});

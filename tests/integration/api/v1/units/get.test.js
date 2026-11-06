import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import units from "models/units.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/units", () => {
  test("Lists SI units and prefixes", async () => {
    const anonymous = await fetch(`${webserver.origin}/api/v1/units`);
    expect(anonymous.status).toBe(403);

    const user = await orchestrator.activateUser(
      await orchestrator.createUser(),
    );
    const session = await orchestrator.createSession(user);
    const response = await fetch(`${webserver.origin}/api/v1/units`, {
      headers: { Cookie: `session_id=${session.token}` },
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    const base = body.units.filter((unit) => unit.kind === "base");
    expect(base.map((unit) => unit.symbol)).toEqual([
      "m",
      "kg",
      "s",
      "A",
      "K",
      "mol",
      "cd",
    ]);
    expect(body.units.filter((unit) => unit.kind === "derived")).toHaveLength(
      23, // 22 do SI + grama
    );
    expect(body.prefixes).toHaveLength(24);
  });

  test("Validates unit expressions against the table", async () => {
    const catalog = await units.list();
    const valid = (expression) => units.isValidExpression(expression, catalog);

    for (const expression of [
      "kg",
      "m³/h",
      "m3/h",
      "t/d",
      "kW·h",
      "kWh",
      "µg/m³",
      "ug/m3",
      "kg/m²·d",
      "L",
      "l/s",
      "°C",
      "Mt",
    ]) {
      expect([expression, valid(expression)]).toEqual([expression, true]);
    }
    for (const expression of ["xyz", "t/dia", "kg CO2/L", "kkg", "m/", ""]) {
      expect([expression, valid(expression)]).toEqual([expression, false]);
    }
  });
});

import { calculateWaterBalance } from "models/water-balance.js";

const flowchart = { id: "chart" };
const groups = [
  { id: "support", name: "Apoio", water_use: "sanitario" },
  { id: "factory", name: "Produção", water_use: "industrial" },
];
const operations = [
  {
    id: "public",
    name: "Rede",
    boundary: "external",
    category: "fonte",
    water_type: "rede_publica",
  },
  {
    id: "well",
    name: "Poço",
    boundary: "external",
    category: "fonte",
    water_type: "subterranea",
  },
  { id: "tank", name: "Reservatório", boundary: "internal" },
  {
    id: "sewer",
    name: "Rede coletora",
    boundary: "external",
    category: "sumidouro",
    water_type: "rede_coletora",
  },
];
const items = [
  { id: "water", name: "Água", category: "agua" },
  { id: "eff", name: "Efluente", category: "efluente" },
];

function calculate(flows, flowItems, extra = {}) {
  return calculateWaterBalance({
    flowchart,
    operations,
    groups,
    flows,
    items,
    flowItems,
    ...extra,
  });
}

test("separates sources and uses through a mixing reservoir", () => {
  const flows = [
    {
      id: "a",
      flowchart_id: "chart",
      source_operation_id: "public",
      target_operation_id: "tank",
    },
    {
      id: "b",
      flowchart_id: "chart",
      source_operation_id: "well",
      target_operation_id: "tank",
    },
    {
      id: "c",
      flowchart_id: "chart",
      source_operation_id: "tank",
      target_group_id: "support",
    },
    {
      id: "d",
      flowchart_id: "chart",
      source_operation_id: "tank",
      target_group_id: "factory",
      water_reuse: true,
    },
    {
      id: "e",
      flowchart_id: "chart",
      source_group_id: "support",
      target_operation_id: "sewer",
    },
  ];
  const flowItems = [60, 100, 40, 120, 35].map((quantity, i) => ({
    id: `item${i}`,
    flow_id: flows[i].id,
    item_id: i === 4 ? "eff" : "water",
    quantity,
    unit: "m³/ano",
  }));
  const result = calculate(flows, flowItems);
  expect(result.totals).toEqual({ input: 160, output: 35, difference: 125 });
  expect(result.rows.find((row) => row.flow_id === "c").use).toBe("sanitario");
  expect(result.rows.find((row) => row.flow_id === "d")).toMatchObject({
    use: "industrial",
    reuse: true,
  });
  expect(result.rows.find((row) => row.flow_id === "c").source_type).toBeNull();
});

test("does not turn missing quantities or incompatible units into zero", () => {
  const flow = {
    id: "a",
    flowchart_id: "chart",
    source_operation_id: "public",
    target_operation_id: "tank",
  };
  const result = calculate(
    [flow],
    [{ id: "i", flow_id: "a", item_id: "water", quantity: 0, unit: "m³/d" }],
  );
  expect(result.incomplete).toBe(true);
  expect(result.totals.difference).toBeNull();
  expect(
    result.warnings.some((warning) => warning.message.includes("m³/ano")),
  ).toBe(true);
});

test("refuses ambiguous water and effluent on the same flow", () => {
  const flow = {
    id: "a",
    flowchart_id: "chart",
    source_operation_id: "public",
    target_operation_id: "tank",
  };
  const result = calculate(
    [flow],
    ["water", "eff"].map((item_id) => ({
      flow_id: "a",
      item_id,
      quantity: 5,
      unit: "m³/ano",
    })),
  );
  expect(result.rows).toHaveLength(0);
  expect(result.incomplete).toBe(true);
});

test("warns about a possible overlap between a group and its operation", () => {
  const groupedOperations = [
    ...operations,
    { id: "tap", name: "Torneira", boundary: "internal", group_id: "support" },
  ];
  const flows = [
    {
      id: "a",
      flowchart_id: "chart",
      source_operation_id: "public",
      target_group_id: "support",
    },
    {
      id: "b",
      flowchart_id: "chart",
      source_operation_id: "public",
      target_operation_id: "tap",
    },
  ];
  const flowItems = flows.map((flow) => ({
    flow_id: flow.id,
    item_id: "water",
    quantity: 20,
    unit: "m³/ano",
  }));
  const result = calculate(flows, flowItems, { operations: groupedOperations });
  expect(result.incomplete).toBe(true);
  expect(result.totals.difference).toBeNull();
  expect(
    result.warnings.some((warning) => warning.message.includes("sobreposição")),
  ).toBe(true);
});

test("warns rather than assigning a missing item quantity or assuming zero", () => {
  const flow = {
    id: "a",
    flowchart_id: "chart",
    source_operation_id: "public",
    target_operation_id: "tank",
  };
  const result = calculate([flow], []);
  expect(result.incomplete).toBe(true);
  expect(
    result.warnings.some((warning) =>
      warning.message.includes("não possui itens"),
    ),
  ).toBe(true);
});

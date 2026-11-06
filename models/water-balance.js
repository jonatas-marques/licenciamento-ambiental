const WATER_CATEGORIES = new Set(["agua", "efluente"]);

// Each flow item is an annual volume; internal transfers are never new sources.
export function calculateWaterBalance({
  flowchart,
  operations,
  groups,
  flows,
  items,
  flowItems,
}) {
  const operationsById = new Map(
    operations.map((operation) => [operation.id, operation]),
  );
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const relevantFlows = flows.filter(
    (flow) => flow.flowchart_id === flowchart.id,
  );
  const rows = [];
  const warnings = [];
  let incomplete = false;

  function endpoint(flow, side) {
    const operation = operationsById.get(flow[`${side}_operation_id`]);
    if (operation) {
      return {
        name: operation.name,
        boundary: operation.boundary,
        category: operation.category,
        group: groupsById.get(operation.group_id),
        type: operation.water_type,
      };
    }
    const group = groupsById.get(flow[`${side}_group_id`]);
    if (group) return { name: group.name, boundary: "internal", group };
    if (flow[`${side}_boundary`]) {
      return { name: "Empreendimento", boundary: "internal" };
    }
    return null;
  }

  for (const flow of relevantFlows) {
    const source = endpoint(flow, "source");
    const target = endpoint(flow, "target");
    const waterItems = flowItems.filter(
      (entry) =>
        entry.flow_id === flow.id &&
        WATER_CATEGORIES.has(itemsById.get(entry.item_id)?.category),
    );
    if (!waterItems.length) {
      if (!flowItems.some((entry) => entry.flow_id === flow.id)) {
        incomplete = true;
        warnings.push({
          flow_id: flow.id,
          message: `O fluxo ${source?.name ?? "?"} → ${target?.name ?? "?"} não possui itens; verifique se transporta água.`,
        });
      }
      continue;
    }
    if (!source || !target || waterItems.length > 1) {
      incomplete = true;
      warnings.push({
        flow_id: flow.id,
        message:
          "Fluxo com pontas inválidas ou mais de um item de água/efluente; verifique para evitar contagem duplicada.",
      });
      continue;
    }
    const entry = waterItems[0];
    if (
      entry.quantity === null ||
      entry.quantity === undefined ||
      !["m³/ano", "m3/ano"].includes(entry.unit)
    ) {
      incomplete = true;
      warnings.push({
        flow_id: flow.id,
        message: "Informe a quantidade anual em m³/ano neste fluxo.",
      });
      continue;
    }
    const amount = Number(entry.quantity);
    if (!Number.isFinite(amount) || amount < 0) {
      incomplete = true;
      warnings.push({
        flow_id: flow.id,
        message: "Quantidade inválida neste fluxo.",
      });
      continue;
    }
    const input =
      source.boundary === "external" && target.boundary === "internal";
    const output =
      source.boundary === "internal" && target.boundary === "external";
    const entersGroup = target.group && target.group.id !== source.group?.id;
    const use = entersGroup ? flow.water_use || target.group.water_use : null;
    if (
      (input && (!source.type || source.category !== "fonte")) ||
      (output && (!target.type || target.category !== "sumidouro"))
    ) {
      incomplete = true;
      warnings.push({
        flow_id: flow.id,
        message: "Classifique a fonte ou o destino hídrico da etapa externa.",
      });
    }
    if (entersGroup && !use) {
      incomplete = true;
      warnings.push({
        flow_id: flow.id,
        message: "Informe o uso hídrico na entrada do grupo.",
      });
    }
    rows.push({
      flow_id: flow.id,
      flow_item_id: entry.id,
      source: source.name,
      target: target.name,
      item: itemsById.get(entry.item_id).name,
      annual: amount,
      source_type: input ? source.type : null,
      destination_type: output ? target.type : null,
      input,
      output,
      group_id: entersGroup ? target.group.id : null,
      use,
      reuse: flow.water_reuse === true,
    });
  }

  const direct = relevantFlows.filter((flow) => flow.target_group_id);
  for (const flow of direct) {
    const sameSource = (other) =>
      (flow.source_operation_id &&
        flow.source_operation_id === other.source_operation_id) ||
      (flow.source_group_id &&
        flow.source_group_id === other.source_group_id) ||
      (flow.source_boundary && other.source_boundary);
    const overlapping = relevantFlows.some(
      (other) =>
        other.id !== flow.id &&
        sameSource(other) &&
        operationsById.get(other.target_operation_id)?.group_id ===
          flow.target_group_id,
    );
    if (overlapping) {
      incomplete = true;
      warnings.push({
        flow_id: flow.id,
        message:
          "Possível sobreposição entre entrada no grupo e entrada em suas etapas; verifique os fluxos.",
      });
    }
  }
  const sum = (list) => list.reduce((total, row) => total + row.annual, 0);
  const inputs = rows.filter((row) => row.input);
  const outputs = rows.filter((row) => row.output);
  if (!inputs.length || !outputs.length) {
    incomplete = true;
    warnings.push({
      flow_id: null,
      message:
        "Não há entrada ou saída hídrica quantificada; confira o fluxograma antes de interpretar o balanço.",
    });
  }
  if (!incomplete && sum(outputs) > sum(inputs)) {
    warnings.push({
      flow_id: null,
      message:
        "As saídas informadas superam as entradas; verifique os dados e a variação de armazenamento.",
    });
  }
  return {
    flowchart_id: flowchart.id,
    unit: "m³/ano",
    rows,
    warnings,
    incomplete,
    totals: {
      input: sum(inputs),
      output: sum(outputs),
      difference: incomplete ? null : sum(inputs) - sum(outputs),
    },
  };
}

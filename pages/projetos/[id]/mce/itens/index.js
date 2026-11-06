import ItemFormFields from "../../../../../interface/ItemFormFields";
import { Heading, Stack } from "@primer/react";
import DefaultLayout from "../../../../../interface/DefaultLayout";
import MceCollectionStatus from "../../../../../interface/MceCollectionStatus";
import MceItemSection from "../../../../../interface/MceItemSection";
import createProjectNavigation from "../../../../../interface/ProjectNavigation";
import useMceCollection from "../../../../../interface/useMceCollection";
import flowchart from "models/flowchart.js";

const title = "Itens";
const description =
  "Materiais, insumos, produtos, resíduos, efluentes, emissões, energia e água que circulam nos fluxogramas.";

// Campos enviados à API; os detalhes variam conforme a categoria do item.
const fields = [
  { name: "name" },
  { name: "category" },
  { name: "description" },
  { name: "details", empty: {} },
];

const categoryLabel = Object.fromEntries(
  flowchart.ITEM_CATEGORIES.map((category) => [category.value, category.label]),
);

function summarize(item) {
  const parts = (flowchart.ITEM_DETAIL_FIELDS[item.category] ?? [])
    .map((field) => {
      const value = item.details?.[field.name];
      if (value === null || value === undefined || value === "") {
        return null;
      }
      const text = typeof value === "boolean" ? (value ? "sim" : "não") : value;
      return `${field.label.replace(/ \(.*\)$/, "")}: ${text}`;
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

// Fluxos em que o item aparece, com a quantidade movimentada em cada um.
function renderUsage(item, extras) {
  const operations = Object.fromEntries(
    (extras.operations ?? []).map((operation) => [operation.id, operation]),
  );
  const flows = Object.fromEntries(
    (extras.flows ?? []).map((flow) => [flow.id, flow]),
  );
  const groups = Object.fromEntries(
    (extras.operation_groups ?? []).map((group) => [group.id, group]),
  );
  const usages = (extras.flow_items ?? []).filter(
    (flowItem) => flowItem.item_id === item.id && flows[flowItem.flow_id],
  );

  if (usages.length === 0) {
    return "—";
  }

  return (
    <ul style={{ margin: 0, paddingLeft: 16 }}>
      {usages.map((flowItem) => {
        const flow = flows[flowItem.flow_id];
        const source =
          operations[flow.source_operation_id]?.name ??
          groups[flow.source_group_id]?.name ??
          (flow.source_boundary ? "Empreendimento" : "?");
        const target =
          operations[flow.target_operation_id]?.name ??
          groups[flow.target_group_id]?.name ??
          (flow.target_boundary ? "Empreendimento" : "?");
        const quantity =
          flowItem.quantity === null || flowItem.quantity === undefined
            ? "sem quantidade"
            : `${flowItem.quantity} ${flowItem.unit ?? ""}`.trim();
        return (
          <li key={flowItem.id}>
            {source} → {target}: {quantity}
          </li>
        );
      })}
    </ul>
  );
}

const columns = [
  { name: "name", label: "Nome" },
  { name: "description", label: "Descrição" },
  { name: "details", label: "Detalhes", render: summarize },
  { name: "usage", label: "Usado em", render: renderUsage },
];

// Um grupo por categoria, na ordem do catálogo; itens sem categoria por último.
const groupBy = {
  groups(items) {
    const groups = flowchart.ITEM_CATEGORIES.map((category) => ({
      key: category.value,
      label: category.label,
      presetValues: { category: category.value },
      items: items.filter((item) => item.category === category.value),
    }));
    groups.push({
      key: "sem-categoria",
      label: "Sem categoria",
      items: items.filter((item) => !categoryLabel[item.category]),
    });
    return groups.filter((group) => group.items.length > 0);
  },
};

export default function ProjectItemsPage() {
  // Fluxos, itens de fluxo e etapas alimentam a coluna "Usado em".
  const mce = useMceCollection("items", [
    "flows",
    "flow_items",
    "operations",
    "operation_groups",
  ]);
  const isReady = mce.loadingStatus === "success" && mce.hasMce;

  return (
    <DefaultLayout
      subNavigation={createProjectNavigation(mce.projectId, "items")}
      metadata={{
        title: "Itens",
        description: "Editar itens do empreendimento ou atividade",
      }}
    >
      <Stack gap="spacious">
        {mce.projectName && <Heading as="h1">{mce.projectName}</Heading>}
        <MceCollectionStatus title={title} {...mce} />
        {isReady && (
          <MceItemSection
            projectId={mce.projectId}
            collection="items"
            title={title}
            description={description}
            singular="item"
            fields={fields}
            columns={columns}
            groupBy={groupBy}
            renderFormFields={(props) => <ItemFormFields {...props} />}
            items={mce.items}
            extras={mce.extras}
            onItemsChange={mce.setItems}
            canEdit={mce.canEdit}
          />
        )}
      </Stack>
    </DefaultLayout>
  );
}

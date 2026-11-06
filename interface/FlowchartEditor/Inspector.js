import { useState } from "react";
import {
  Button,
  FormControl,
  Heading,
  IconButton,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@primer/react";
import { PlusIcon, TrashIcon } from "@primer/octicons-react";
import flowchart from "models/flowchart.js";
import UnitInput from "./UnitInput";
import styles from "./index.module.css";

// Painel direito: propriedades do elemento selecionado.
export default function Inspector({
  selection,
  operations,
  groups,
  flows,
  items,
  flowItems,
  canEdit,
  disabled,
  onSave,
  onRemove,
  onAddFlowItem,
  onRemoveFlowItem,
}) {
  if (!selection) {
    return (
      <Text className={styles.hint}>
        Selecione uma etapa ou um fluxo para editar suas propriedades. Para
        criar um fluxo, arraste de um ponto de conexão de uma etapa até outra.
      </Text>
    );
  }

  const operationName = (id) =>
    operations.find((operation) => operation.id === id)?.name;

  if (selection.kind === "item") {
    const item = items.find((entry) => entry.id === selection.id);
    return (
      <ItemForm
        key={item.id}
        item={item}
        canEdit={canEdit}
        disabled={disabled}
        onSave={(values) => onSave("items", item.id, values)}
        onRemove={() => onRemove("items", item)}
      />
    );
  }

  if (selection.kind === "operation") {
    const operation = operations.find((entry) => entry.id === selection.id);
    return (
      <OperationForm
        key={`${operation.id}-${operation.boundary}-${operation.category}`}
        operation={operation}
        groups={groups}
        canEdit={canEdit}
        disabled={disabled}
        onSave={(values) => onSave("operations", operation.id, values)}
        onRemove={() => onRemove("operations", operation)}
      />
    );
  }

  if (selection.kind === "group") {
    const group = groups.find((entry) => entry.id === selection.id);
    return (
      <GroupForm
        key={group.id}
        group={group}
        canEdit={canEdit}
        disabled={disabled}
        onSave={(values) => onSave("operation_groups", group.id, values)}
        onRemove={() => onRemove("operation_groups", group)}
      />
    );
  }

  const flow = flows.find((entry) => entry.id === selection.id);
  const endpointName = (side) =>
    operationName(flow[`${side}_operation_id`]) ??
    groups.find((group) => group.id === flow[`${side}_group_id`])?.name ??
    "Empreendimento";
  const direction = flowchart.flowDirection(
    operations.find((entry) => entry.id === flow.source_operation_id)
      ?.boundary ?? "internal",
    operations.find((entry) => entry.id === flow.target_operation_id)
      ?.boundary ?? "internal",
  );
  return (
    <FlowForm
      key={flow.id}
      flow={flow}
      direction={direction}
      title={`${endpointName("source")} → ${endpointName("target")}`}
      operations={operations}
      groups={groups}
      items={items}
      flowItems={flowItems.filter((entry) => entry.flow_id === flow.id)}
      canEdit={canEdit}
      disabled={disabled}
      onSave={(values) => onSave("flows", flow.id, values)}
      onRemove={() => onRemove("flows", flow)}
      onAddFlowItem={onAddFlowItem}
      onRemoveFlowItem={onRemoveFlowItem}
      onSaveFlowItem={(id, values) => onSave("flow_items", id, values)}
    />
  );
}

function OperationForm({
  operation,
  groups,
  canEdit,
  disabled,
  onSave,
  onRemove,
}) {
  const [values, setValues] = useState({
    name: operation.name ?? "",
    type: operation.type ?? "",
    category: operation.category ?? "",
    description: operation.description ?? "",
    group_id: operation.group_id ?? "",
    water_type: operation.water_type ?? "",
  });
  const bind = (name) => ({
    value: values[name],
    disabled: !canEdit,
    onChange: (event) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
  });
  const isInternal = operation.boundary === "internal";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(values);
      }}
    >
      <Stack gap="condensed">
        <Heading as="h3" className={styles.inspectorTitle}>
          Etapa
        </Heading>
        <Text className={styles.hint}>
          {isInternal
            ? "Interna: dentro do empreendimento. Impacto com origem no próprio empreendimento."
            : "Externa: fora do empreendimento. Origem de recursos ou destino de saídas, com impacto externo."}{" "}
          Arraste a etapa para dentro ou para fora do retângulo para mudar.
        </Text>
        <FormControl required>
          <FormControl.Label>Nome</FormControl.Label>
          <TextInput block {...bind("name")} />
        </FormControl>
        <FormControl>
          <FormControl.Label>Categoria</FormControl.Label>
          <Select
            block
            {...bind("category")}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                category: event.target.value,
                water_type: "",
              }))
            }
          >
            {flowchart.OPERATION_CATEGORIES.filter(
              (entry) => entry.boundary === operation.boundary,
            ).map((entry) => (
              <Select.Option key={entry.value} value={entry.value}>
                {entry.label}
              </Select.Option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <FormControl.Label>Tipo</FormControl.Label>
          <TextInput block {...bind("type")} />
        </FormControl>
        {isInternal && (
          <FormControl>
            <FormControl.Label>Grupo de processo</FormControl.Label>
            <Select block {...bind("group_id")}>
              <Select.Option value="">Sem grupo</Select.Option>
              {groups.map((group) => (
                <Select.Option key={group.id} value={group.id}>
                  {group.name}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
        )}
        {["fonte", "sumidouro"].includes(values.category) && (
          <FormControl>
            <FormControl.Label>Tipo hídrico</FormControl.Label>
            <Select
              block
              {...bind("water_type")}
              onChange={(event) => {
                const value = event.target.value;
                const type = flowchart.WATER_TYPES.find(
                  (entry) => entry.value === value,
                );
                setValues((current) => ({
                  ...current,
                  water_type: value,
                  name:
                    type &&
                    (["Fonte", "Sumidouro"].includes(current.name) ||
                      flowchart.WATER_TYPES.some(
                        (entry) => entry.label === current.name,
                      ))
                      ? type.label
                      : current.name,
                }));
              }}
            >
              <Select.Option value="">Não informado</Select.Option>
              {flowchart.WATER_TYPES.filter(
                (entry) => entry.category === values.category,
              ).map((entry) => (
                <Select.Option key={entry.value} value={entry.value}>
                  {entry.label}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
        )}
        <FormControl>
          <FormControl.Label>Descrição</FormControl.Label>
          <Textarea block rows={3} {...bind("description")} />
        </FormControl>
        {canEdit && (
          <div>
            <Button type="submit" variant="primary" disabled={disabled}>
              Salvar
            </Button>{" "}
            <Button
              type="button"
              variant="danger"
              leadingVisual={TrashIcon}
              disabled={disabled}
              onClick={onRemove}
            >
              Remover
            </Button>
          </div>
        )}
      </Stack>
    </form>
  );
}

function GroupForm({ group, canEdit, disabled, onSave, onRemove }) {
  const [values, setValues] = useState({
    name: group.name,
    water_use: group.water_use ?? "",
    shape_x: group.shape_x,
    shape_y: group.shape_y,
    width: group.width,
    height: group.height,
  });
  const bind = (name) => ({
    value: values[name],
    disabled: !canEdit,
    onChange: (event) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(values);
      }}
    >
      <Stack gap="condensed">
        <Heading as="h3" className={styles.inspectorTitle}>
          Grupo de processo
        </Heading>
        <FormControl required>
          <FormControl.Label>Nome</FormControl.Label>
          <TextInput block {...bind("name")} />
        </FormControl>
        <FormControl>
          <FormControl.Label>Uso hídrico sugerido</FormControl.Label>
          <Select block {...bind("water_use")}>
            <Select.Option value="">Não informado</Select.Option>
            {flowchart.WATER_USES.map((entry) => (
              <Select.Option key={entry.value} value={entry.value}>
                {entry.label}
              </Select.Option>
            ))}
          </Select>
        </FormControl>
        {[
          ["shape_x", "Posição horizontal", 0],
          ["shape_y", "Posição vertical", 0],
          ["width", "Largura", 100],
          ["height", "Altura", 80],
        ].map(([key, label, min]) => (
          <FormControl key={key}>
            <FormControl.Label>{label}</FormControl.Label>
            <TextInput block type="number" min={min} {...bind(key)} />
          </FormControl>
        ))}
        {canEdit && (
          <div>
            <Button type="submit" variant="primary" disabled={disabled}>
              Salvar
            </Button>{" "}
            <Button
              type="button"
              variant="danger"
              disabled={disabled}
              onClick={onRemove}
            >
              Remover grupo
            </Button>
          </div>
        )}
      </Stack>
    </form>
  );
}

function ItemForm({ item, canEdit, disabled, onSave, onRemove }) {
  const [values, setValues] = useState({
    name: item.name ?? "",
    category: item.category ?? "",
    description: item.description ?? "",
  });
  const [details, setDetails] = useState(item.details ?? {});
  const detailFields = flowchart.ITEM_DETAIL_FIELDS[values.category] ?? [];
  const bind = (name) => ({
    value: values[name],
    disabled: !canEdit,
    onChange: (event) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
  });

  function detailValue(field) {
    const value = details[field.name];
    if (field.boolean) {
      return value === true ? "true" : value === false ? "false" : "";
    }
    return value ?? "";
  }

  function setDetail(field, raw) {
    const value = field.boolean && raw !== "" ? raw === "true" : raw;
    setDetails((current) => ({ ...current, [field.name]: value }));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          ...values,
          details: Object.fromEntries(
            detailFields.map((field) => [
              field.name,
              details[field.name] ?? "",
            ]),
          ),
        });
      }}
    >
      <Stack gap="condensed">
        <Heading as="h3" className={styles.inspectorTitle}>
          Item
        </Heading>
        <FormControl required>
          <FormControl.Label>Nome</FormControl.Label>
          <TextInput block {...bind("name")} />
        </FormControl>
        <FormControl>
          <FormControl.Label>Categoria</FormControl.Label>
          <Select block {...bind("category")}>
            <Select.Option value="">—</Select.Option>
            {flowchart.ITEM_CATEGORIES.map((category) => (
              <Select.Option key={category.value} value={category.value}>
                {category.label}
              </Select.Option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <FormControl.Label>Descrição</FormControl.Label>
          <Textarea block rows={2} {...bind("description")} />
        </FormControl>
        {detailFields.map((field) => (
          <FormControl key={`${values.category}-${field.name}`}>
            <FormControl.Label>{field.label}</FormControl.Label>
            {field.boolean ? (
              <Select
                block
                disabled={!canEdit}
                value={detailValue(field)}
                onChange={(event) => setDetail(field, event.target.value)}
              >
                <Select.Option value="">—</Select.Option>
                <Select.Option value="true">Sim</Select.Option>
                <Select.Option value="false">Não</Select.Option>
              </Select>
            ) : field.multiline ? (
              <Textarea
                block
                rows={2}
                disabled={!canEdit}
                value={detailValue(field)}
                onChange={(event) => setDetail(field, event.target.value)}
              />
            ) : field.name === "unit" ? (
              <UnitInput
                block
                disabled={!canEdit}
                value={detailValue(field)}
                onChange={(event) => setDetail(field, event.target.value)}
              />
            ) : (
              <TextInput
                block
                disabled={!canEdit}
                type={field.number ? "number" : "text"}
                min={field.number ? "0" : undefined}
                step={field.number ? "any" : undefined}
                value={detailValue(field)}
                onChange={(event) => setDetail(field, event.target.value)}
              />
            )}
          </FormControl>
        ))}
        {canEdit && (
          <div>
            <Button type="submit" variant="primary" disabled={disabled}>
              Salvar
            </Button>{" "}
            <Button
              type="button"
              variant="danger"
              leadingVisual={TrashIcon}
              disabled={disabled}
              onClick={onRemove}
            >
              Remover
            </Button>
          </div>
        )}
      </Stack>
    </form>
  );
}

function FlowForm({
  flow,
  direction,
  title,
  operations,
  groups,
  items,
  flowItems,
  canEdit,
  disabled,
  onSave,
  onRemove,
  onAddFlowItem,
  onRemoveFlowItem,
  onSaveFlowItem,
}) {
  const [values, setValues] = useState({
    label: flow.label ?? "",
    type: flow.type ?? "",
    description: flow.description ?? "",
    water_use: flow.water_use ?? "",
    water_reuse: flow.water_reuse ?? false,
  });
  const endpointValue = (side) => {
    if (flow[`${side}_operation_id`])
      return `operation:${flow[`${side}_operation_id`]}`;
    if (flow[`${side}_group_id`]) return `group:${flow[`${side}_group_id`]}`;
    return "boundary";
  };
  const [endpoints, setEndpoints] = useState({
    source: endpointValue("source"),
    target: endpointValue("target"),
  });
  function endpointFields(side) {
    const [kind, id] = endpoints[side].split(":");
    return {
      [`${side}_operation_id`]: kind === "operation" ? id : null,
      [`${side}_group_id`]: kind === "group" ? id : null,
      [`${side}_boundary`]: kind === "boundary",
    };
  }
  const [entry, setEntry] = useState({ item_id: "", quantity: "", unit: "" });
  const bind = (name) => ({
    value: values[name],
    disabled: !canEdit,
    onChange: (event) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
  });
  const itemName = (id) => items.find((item) => item.id === id)?.name;
  const suggestedCategories = flowchart.suggestedItemCategories(direction);
  const suggested = items.filter((item) =>
    suggestedCategories.includes(item.category),
  );
  const others = items.filter((item) => !suggested.includes(item));
  const directionHint = {
    input: "Entrada no empreendimento (cruza a fronteira).",
    output: "Saída do empreendimento (cruza a fronteira).",
  }[direction];

  return (
    <Stack gap="condensed">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            ...values,
            ...endpointFields("source"),
            ...endpointFields("target"),
          });
        }}
      >
        <Stack gap="condensed">
          <Heading as="h3" className={styles.inspectorTitle}>
            Fluxo
          </Heading>
          <Text className={styles.hint}>
            {title}
            {directionHint && ` ${directionHint}`}
          </Text>
          {["source", "target"].map((side) => (
            <FormControl key={side}>
              <FormControl.Label>
                {side === "source" ? "Origem" : "Destino"}
              </FormControl.Label>
              <Select
                block
                disabled={!canEdit}
                value={endpoints[side]}
                onChange={(event) =>
                  setEndpoints((current) => ({
                    ...current,
                    [side]: event.target.value,
                  }))
                }
              >
                <Select.Option value="boundary">
                  Fronteira do empreendimento
                </Select.Option>
                <Select.OptGroup label="Etapas">
                  {operations.map((operation) => (
                    <Select.Option
                      key={operation.id}
                      value={`operation:${operation.id}`}
                    >
                      {operation.name}
                    </Select.Option>
                  ))}
                </Select.OptGroup>
                {groups.length > 0 && (
                  <Select.OptGroup label="Grupos">
                    {groups.map((group) => (
                      <Select.Option key={group.id} value={`group:${group.id}`}>
                        {group.name}
                      </Select.Option>
                    ))}
                  </Select.OptGroup>
                )}
              </Select>
            </FormControl>
          ))}
          <FormControl>
            <FormControl.Label>Rótulo</FormControl.Label>
            <TextInput block {...bind("label")} />
          </FormControl>
          <FormControl>
            <FormControl.Label>Tipo</FormControl.Label>
            <TextInput block {...bind("type")} />
          </FormControl>
          <FormControl>
            <FormControl.Label>Descrição</FormControl.Label>
            <Textarea block rows={2} {...bind("description")} />
          </FormControl>
          <FormControl>
            <FormControl.Label>Uso hídrico nesta entrada</FormControl.Label>
            <Select block {...bind("water_use")}>
              <Select.Option value="">Usar sugestão do grupo</Select.Option>
              {flowchart.WATER_USES.map((entry) => (
                <Select.Option key={entry.value} value={entry.value}>
                  {entry.label}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
          <label>
            <input
              type="checkbox"
              checked={values.water_reuse}
              disabled={!canEdit}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  water_reuse: event.target.checked,
                }))
              }
            />{" "}
            Água de reúso
          </label>
          {canEdit && (
            <div>
              <Button type="submit" variant="primary" disabled={disabled}>
                Salvar
              </Button>{" "}
              <Button
                type="button"
                variant="danger"
                leadingVisual={TrashIcon}
                disabled={disabled}
                onClick={onRemove}
              >
                Remover
              </Button>
            </div>
          )}
        </Stack>
      </form>

      <Heading as="h4" className={styles.inspectorTitle}>
        Itens que circulam
      </Heading>
      {flowItems.length === 0 && <Text className={styles.hint}>Nenhum.</Text>}
      {flowItems.map((flowItem) => (
        <FlowItemEditor
          key={flowItem.id}
          item={flowItem}
          name={itemName(flowItem.item_id)}
          canEdit={canEdit}
          disabled={disabled}
          onSave={onSaveFlowItem}
          onRemove={() => onRemoveFlowItem(flowItem)}
        />
      ))}

      {canEdit && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onAddFlowItem({ flow_id: flow.id, ...entry })) {
              setEntry({ item_id: "", quantity: "", unit: "" });
            }
          }}
        >
          <Stack gap="condensed">
            <Select
              block
              required
              aria-label="Item"
              value={entry.item_id}
              onChange={(event) =>
                setEntry((current) => ({
                  ...current,
                  item_id: event.target.value,
                }))
              }
            >
              <Select.Option value="">Selecione um item</Select.Option>
              {suggested.length > 0 && (
                <Select.OptGroup label="Sugeridos para este fluxo">
                  {suggested.map((item) => (
                    <Select.Option key={item.id} value={item.id}>
                      {item.name}
                    </Select.Option>
                  ))}
                </Select.OptGroup>
              )}
              <Select.OptGroup
                label={suggested.length > 0 ? "Outros" : "Itens"}
              >
                {others.map((item) => (
                  <Select.Option key={item.id} value={item.id}>
                    {item.name}
                  </Select.Option>
                ))}
              </Select.OptGroup>
            </Select>
            <div className={styles.row}>
              <TextInput
                type="number"
                min="0"
                step="any"
                placeholder="Qtd."
                aria-label="Quantidade"
                value={entry.quantity}
                onChange={(event) =>
                  setEntry((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
              />
              <UnitInput
                placeholder="Unid."
                aria-label="Unidade"
                value={entry.unit}
                onChange={(event) =>
                  setEntry((current) => ({
                    ...current,
                    unit: event.target.value,
                  }))
                }
              />
            </div>
            <Button
              type="submit"
              size="small"
              leadingVisual={PlusIcon}
              disabled={disabled || items.length === 0}
            >
              Adicionar item
            </Button>
            {items.length === 0 && (
              <Text className={styles.hint}>
                Cadastre itens no painel à esquerda.
              </Text>
            )}
          </Stack>
        </form>
      )}
    </Stack>
  );
}

function FlowItemEditor({ item, name, canEdit, disabled, onSave, onRemove }) {
  const [quantity, setQuantity] = useState(item.quantity ?? "");
  const [unit, setUnit] = useState(item.unit ?? "");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(item.id, { quantity, unit });
      }}
    >
      <Text>{name}</Text>
      {canEdit ? (
        <Stack gap="condensed">
          <TextInput
            type="number"
            min="0"
            step="any"
            aria-label={`Quantidade de ${name}`}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <UnitInput
            aria-label={`Unidade de ${name}`}
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          />
          <div>
            <Button type="submit" size="small" disabled={disabled}>
              Salvar quantidade
            </Button>{" "}
            <IconButton
              type="button"
              size="small"
              variant="danger"
              icon={TrashIcon}
              aria-label={`Remover ${name} do fluxo`}
              disabled={disabled}
              onClick={onRemove}
            />
          </div>
        </Stack>
      ) : (
        <Text> {flowchart.describeFlowItem(item, "")}</Text>
      )}
    </form>
  );
}

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
        canEdit={canEdit}
        disabled={disabled}
        onSave={(values) => onSave("operations", operation.id, values)}
        onRemove={() => onRemove("operations", operation)}
      />
    );
  }

  const flow = flows.find((entry) => entry.id === selection.id);
  const direction = flowchart.flowDirection(
    operations.find((entry) => entry.id === flow.source_operation_id)?.boundary,
    operations.find((entry) => entry.id === flow.target_operation_id)?.boundary,
  );
  return (
    <FlowForm
      key={flow.id}
      flow={flow}
      direction={direction}
      title={`${operationName(flow.source_operation_id)} → ${operationName(flow.target_operation_id)}`}
      items={items}
      flowItems={flowItems.filter((entry) => entry.flow_id === flow.id)}
      canEdit={canEdit}
      disabled={disabled}
      onSave={(values) => onSave("flows", flow.id, values)}
      onRemove={() => onRemove("flows", flow)}
      onAddFlowItem={onAddFlowItem}
      onRemoveFlowItem={onRemoveFlowItem}
    />
  );
}

function OperationForm({ operation, canEdit, disabled, onSave, onRemove }) {
  const [values, setValues] = useState({
    name: operation.name ?? "",
    type: operation.type ?? "",
    category: operation.category ?? "",
    description: operation.description ?? "",
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
          <Select block {...bind("category")}>
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
  items,
  flowItems,
  canEdit,
  disabled,
  onSave,
  onRemove,
  onAddFlowItem,
  onRemoveFlowItem,
}) {
  const [values, setValues] = useState({
    label: flow.label ?? "",
    type: flow.type ?? "",
    description: flow.description ?? "",
  });
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
          onSave(values);
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
        <div key={flowItem.id} className={styles.row}>
          <Text>
            {flowchart.describeFlowItem(flowItem, itemName(flowItem.item_id))}
          </Text>
          {canEdit && (
            <IconButton
              type="button"
              size="small"
              variant="danger"
              icon={TrashIcon}
              aria-label={`Remover ${itemName(flowItem.item_id)} do fluxo`}
              disabled={disabled}
              onClick={() => onRemoveFlowItem(flowItem)}
            />
          )}
        </div>
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

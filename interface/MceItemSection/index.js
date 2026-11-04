import { useState } from "react";
import {
  Banner,
  Button,
  FormControl,
  Heading,
  IconButton,
  Stack,
  Text,
  TextInput,
  Textarea,
  useConfirm,
} from "@primer/react";
import { Blankslate, Card, DataTable, Table } from "@primer/react/experimental";
import { PencilIcon, PlusIcon, TrashIcon } from "@primer/octicons-react";

const ADD_ROW_ID = "__add_row__";

// Seção genérica de CRUD para os itens do MCE (fluxogramas, equipamentos...).
export default function MceItemSection({
  projectId,
  collection,
  title,
  description,
  singular,
  fields,
  renderFormFields,
  columns,
  groupBy,
  items,
  extras = {},
  onItemsChange,
  canEdit,
}) {
  const confirm = useConfirm();
  const emptyForm = Object.fromEntries(
    fields.map((field) => [field.name, field.empty ?? ""]),
  );
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(emptyForm);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
  const baseUrl = `/api/v1/projects/${projectId}/mce/${collection}`;

  function toForm(item) {
    return Object.fromEntries(
      fields.map((field) => [
        field.name,
        item[field.name] ?? field.empty ?? "",
      ]),
    );
  }

  async function request(url, options) {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(`${body.message} ${body.action}`.trim());
      }

      setStatus("idle");
      return body;
    } catch (error) {
      setErrorMessage(error.message || "Não foi possível concluir a ação.");
      setStatus("idle");
      return null;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const body = JSON.stringify(formValues);
    const saved = editingId
      ? await request(`${baseUrl}/${editingId}`, { method: "PATCH", body })
      : await request(baseUrl, { method: "POST", body });

    if (!saved) {
      return;
    }

    onItemsChange(
      editingId
        ? items.map((item) => (item.id === saved.id ? saved : item))
        : [...items, saved],
    );
    closeForm();
  }

  async function handleRemove(item) {
    const confirmed = await confirm({
      title: `Remover ${item.name}?`,
      content: `Este ${singular} será removido do MCE.`,
      confirmButtonContent: "Remover",
      confirmButtonType: "danger",
      cancelButtonContent: "Cancelar",
    });

    if (!confirmed) {
      return;
    }

    const removed = await request(`${baseUrl}/${item.id}`, {
      method: "DELETE",
    });

    if (removed) {
      onItemsChange(items.filter((current) => current.id !== removed.id));
    }
  }

  function openForm(item, presetValues) {
    setEditingId(item?.id ?? null);
    setFormValues(
      item ? toForm(item) : { ...emptyForm, ...(presetValues ?? {}) },
    );
    setErrorMessage(null);
    setIsAdding(true);
    if (presetValues) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function closeForm() {
    setIsAdding(false);
    setEditingId(null);
    setFormValues(emptyForm);
  }

  const isLoading = status === "loading";

  function renderTable(rows, labelId, withAddRow) {
    return (
      <Table.Container>
        <DataTable
          aria-labelledby={labelId}
          data={withAddRow && canEdit ? [...rows, { id: ADD_ROW_ID }] : rows}
          columns={[
            ...columns.map((column, index) => ({
              header: column.label,
              field: column.name,
              rowHeader: column.name === "name",
              renderCell: (item) => {
                if (item.id === ADD_ROW_ID) {
                  return index === 0 ? (
                    <Button
                      type="button"
                      size="small"
                      variant="invisible"
                      leadingVisual={PlusIcon}
                      onClick={() => openForm()}
                      disabled={isLoading}
                      aria-label={`Adicionar ${singular}`}
                    >
                      Adicionar {singular}
                    </Button>
                  ) : null;
                }
                return column.render
                  ? column.render(item, extras)
                  : (item[column.name] ?? "—");
              },
            })),
            ...(canEdit
              ? [
                  {
                    id: "actions",
                    header: "Ações",
                    renderCell: (item) =>
                      item.id === ADD_ROW_ID ? null : (
                        <>
                          <IconButton
                            type="button"
                            size="small"
                            icon={PencilIcon}
                            aria-label={`Alterar ${item.name}`}
                            onClick={() => openForm(item)}
                            disabled={isLoading}
                          />{" "}
                          <IconButton
                            type="button"
                            size="small"
                            variant="danger"
                            icon={TrashIcon}
                            aria-label={`Remover ${item.name}`}
                            onClick={() => handleRemove(item)}
                            disabled={isLoading}
                          />
                        </>
                      ),
                  },
                ]
              : []),
          ]}
        />
      </Table.Container>
    );
  }

  return (
    <Stack gap="normal">
      <div className="project-section-heading">
        <div>
          <Heading as="h2" id={`${collection}-title`}>
            {title}
          </Heading>
          <Text>{description}</Text>
        </div>
        {canEdit && (
          <Button
            variant="primary"
            leadingVisual={PlusIcon}
            onClick={() => openForm()}
            disabled={isLoading}
          >
            Adicionar {singular}
          </Button>
        )}
      </div>

      {errorMessage && (
        <Banner
          variant="critical"
          title="Não foi possível concluir a alteração"
          description={errorMessage}
        />
      )}

      {isAdding && (
        <Card>
          <form onSubmit={handleSubmit}>
            <Stack gap="normal">
              <Heading as="h3">
                {editingId ? `Alterar ${singular}` : `Adicionar ${singular}`}
              </Heading>
              {renderFormFields ? (
                renderFormFields({
                  values: formValues,
                  setValues: setFormValues,
                  disabled: isLoading,
                })
              ) : (
                <DefaultFormFields
                  fields={fields}
                  values={formValues}
                  setValues={setFormValues}
                  disabled={isLoading}
                />
              )}
              <div>
                <Button type="button" onClick={closeForm} disabled={isLoading}>
                  Cancelar
                </Button>{" "}
                <Button type="submit" variant="primary" disabled={isLoading}>
                  {isLoading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </Stack>
          </form>
        </Card>
      )}

      {items.length === 0 && !isAdding && (
        <Blankslate border>
          <Blankslate.Heading>Nenhum item cadastrado</Blankslate.Heading>
          <Blankslate.Description>
            Os itens adicionados aparecerão aqui.
          </Blankslate.Description>
        </Blankslate>
      )}

      {columns &&
        items.length > 0 &&
        (groupBy
          ? groupBy.groups(items).map((group) => (
              <Stack key={group.key} gap="condensed">
                <Heading
                  as="h3"
                  id={`${collection}-${group.key}`}
                  variant="medium"
                >
                  {group.label} ({group.items.length})
                </Heading>
                {renderTable(group.items, `${collection}-${group.key}`, false)}
                {canEdit && group.presetValues && (
                  <div>
                    <Button
                      type="button"
                      size="small"
                      variant="invisible"
                      leadingVisual={PlusIcon}
                      onClick={() => openForm(null, group.presetValues)}
                      disabled={isLoading}
                    >
                      Adicionar {singular} em {group.label}
                    </Button>
                  </div>
                )}
              </Stack>
            ))
          : renderTable(items, `${collection}-title`, true))}

      {!columns &&
        items.map((item) => (
          <Card key={item.id}>
            <Card.Heading>{item.name}</Card.Heading>
            {fields
              .filter((field) => field.name !== "name" && item[field.name])
              .map((field) => (
                <Card.Description key={field.name}>
                  {field.label}: {item[field.name]}
                </Card.Description>
              ))}
            {canEdit && (
              <Card.Action>
                <Button
                  type="button"
                  size="small"
                  leadingVisual={PencilIcon}
                  onClick={() => openForm(item)}
                  disabled={isLoading}
                >
                  Alterar
                </Button>{" "}
                <Button
                  type="button"
                  size="small"
                  variant="danger"
                  leadingVisual={TrashIcon}
                  onClick={() => handleRemove(item)}
                  disabled={isLoading}
                >
                  Remover
                </Button>
              </Card.Action>
            )}
          </Card>
        ))}
    </Stack>
  );
}

function DefaultFormFields({ fields, values, setValues, disabled }) {
  return fields.map((field) => {
    const onChange = (event) =>
      setValues({ ...values, [field.name]: event.target.value });

    return (
      <FormControl key={field.name} required={Boolean(field.required)}>
        <FormControl.Label>{field.label}</FormControl.Label>
        {field.multiline ? (
          <Textarea
            value={values[field.name]}
            onChange={onChange}
            block
            disabled={disabled}
          />
        ) : (
          <TextInput
            value={values[field.name]}
            onChange={onChange}
            type={field.type === "number" ? "number" : "text"}
            min={field.type === "number" ? 0 : undefined}
            step={field.type === "number" ? "any" : undefined}
            required={Boolean(field.required)}
            block
            disabled={disabled}
          />
        )}
      </FormControl>
    );
  });
}

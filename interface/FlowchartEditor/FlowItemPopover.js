import { useState } from "react";
import { Button, Select, TextInput } from "@primer/react";
import flowchart from "models/flowchart.js";
import UnitInput from "./UnitInput";
import styles from "./index.module.css";

const NEW_ITEM = "new";

// Formulário flutuante aberto com duplo clique no fluxo: escolhe um item
// existente ou cria um novo e já o associa ao fluxo.
export default function FlowItemPopover({
  items,
  disabled,
  onSubmit,
  onClose,
}) {
  const [choice, setChoice] = useState(NEW_ITEM);
  const [values, setValues] = useState({
    name: "",
    category: "",
    quantity: "",
    unit: "",
  });
  const isNew = choice === NEW_ITEM;
  const bind = (name) => ({
    value: values[name],
    onChange: (event) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
  });

  return (
    <form
      className={styles.itemPopover}
      aria-label="Adicionar item ao fluxo"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          onClose();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ existingId: isNew ? null : choice, ...values });
      }}
    >
      <Select
        block
        aria-label="Item"
        value={choice}
        onChange={(event) => setChoice(event.target.value)}
      >
        <Select.Option value={NEW_ITEM}>Novo item</Select.Option>
        {items.map((item) => (
          <Select.Option key={item.id} value={item.id}>
            {item.name}
          </Select.Option>
        ))}
      </Select>
      {isNew && (
        <>
          <TextInput
            block
            required
            autoFocus
            placeholder="Nome do item"
            aria-label="Nome do item"
            {...bind("name")}
          />
          <Select block aria-label="Categoria do item" {...bind("category")}>
            <Select.Option value="">Categoria</Select.Option>
            {flowchart.ITEM_CATEGORIES.map((category) => (
              <Select.Option key={category.value} value={category.value}>
                {category.label}
              </Select.Option>
            ))}
          </Select>
        </>
      )}
      <div className={styles.itemPopoverRow}>
        <TextInput
          block
          type="number"
          min="0"
          step="any"
          placeholder="Quantidade"
          aria-label="Quantidade"
          {...bind("quantity")}
        />
        <UnitInput
          block
          placeholder="Unid."
          aria-label="Unidade"
          {...bind("unit")}
        />
      </div>
      <div className={styles.itemPopoverRow}>
        <Button
          type="submit"
          variant="primary"
          size="small"
          disabled={disabled}
        >
          Adicionar
        </Button>
        <Button type="button" size="small" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

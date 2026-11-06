import { FormControl, Select, TextInput, Textarea } from "@primer/react";
import flowchart from "models/flowchart.js";
import UnitInput from "../FlowchartEditor/UnitInput";

// Formulário de item do MCE: nome, categoria e os detalhes da categoria.
export default function ItemFormFields({ values, setValues, disabled }) {
  const details =
    values.details && typeof values.details === "object" ? values.details : {};
  const detailFields = flowchart.ITEM_DETAIL_FIELDS[values.category] ?? [];

  const bind = (name) => ({
    value: values[name],
    disabled,
    onChange: (event) => setValues({ ...values, [name]: event.target.value }),
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
    setValues({ ...values, details: { ...details, [field.name]: value } });
  }

  return (
    <>
      <FormControl required>
        <FormControl.Label>Nome</FormControl.Label>
        <TextInput block required {...bind("name")} />
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
              disabled={disabled}
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
              disabled={disabled}
              value={detailValue(field)}
              onChange={(event) => setDetail(field, event.target.value)}
            />
          ) : field.name === "unit" ? (
            <UnitInput
              block
              disabled={disabled}
              value={detailValue(field)}
              onChange={(event) => setDetail(field, event.target.value)}
            />
          ) : (
            <TextInput
              block
              disabled={disabled}
              type={field.number ? "number" : "text"}
              min={field.number ? "0" : undefined}
              step={field.number ? "any" : undefined}
              value={detailValue(field)}
              onChange={(event) => setDetail(field, event.target.value)}
            />
          )}
        </FormControl>
      ))}
    </>
  );
}

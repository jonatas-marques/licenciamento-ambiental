import { useEffect, useState } from "react";
import {
  ActionList,
  Button,
  FormControl,
  Text,
  TextInput,
  Textarea,
} from "@primer/react";
import { PencilIcon, SearchIcon } from "@primer/octicons-react";
import styles from "./index.module.css";

const detailFields = [
  { name: "brand", label: "Marca" },
  { name: "model", label: "Modelo" },
  { name: "power", label: "Potência", type: "number" },
  { name: "capacity", label: "Capacidade", type: "number" },
  { name: "mobility", label: "Mobilidade" },
  { name: "location", label: "Local" },
  { name: "status", label: "Situação" },
];

const emptyCatalog = { models: [], names: [] };

// Formulário de equipamento: primeiro uma busca no catálogo; ao escolher uma
// opção (ou "inserir manualmente") os demais campos aparecem preenchidos e
// continuam editáveis.
export default function EquipmentFormFields({ values, setValues, disabled }) {
  const [step, setStep] = useState(
    values.name_id || values.custom_name ? "details" : "search",
  );
  const [selectionLabel, setSelectionLabel] = useState(null);

  function applySelection(changes, label) {
    setValues({
      ...values,
      name_id: "",
      model_id: "",
      custom_name: "",
      ...changes,
    });
    setSelectionLabel(label);
    setStep("details");
  }

  if (step === "search") {
    return (
      <CatalogSearch
        onPickModel={(entry) =>
          applySelection(
            {
              name_id: entry.name_id,
              model_id: entry.id,
              brand: entry.brand,
              model: entry.model,
              power: entry.power ?? "",
              capacity: entry.capacity ?? "",
              mobility: entry.mobility ?? "",
            },
            `${entry.name} ${entry.brand} ${entry.model}`,
          )
        }
        onPickName={(entry) =>
          applySelection(
            { name_id: entry.id },
            `${entry.name} (${entry.category})`,
          )
        }
        onPickManual={(text) => applySelection({ custom_name: text }, null)}
        disabled={disabled}
      />
    );
  }

  const isManual = !values.name_id;
  const setField = (name) => (event) =>
    setValues({ ...values, [name]: event.target.value });

  return (
    <>
      <div className={styles.selection}>
        <Text weight="semibold">
          {isManual
            ? "Equipamento informado manualmente"
            : selectionLabel || "Equipamento do catálogo"}
        </Text>
        <Button
          type="button"
          size="small"
          leadingVisual={PencilIcon}
          onClick={() => setStep("search")}
          disabled={disabled}
        >
          Trocar equipamento
        </Button>
      </div>

      {isManual && (
        <FormControl required>
          <FormControl.Label>Nome do equipamento</FormControl.Label>
          <TextInput
            value={values.custom_name}
            onChange={setField("custom_name")}
            required
            block
            disabled={disabled}
          />
        </FormControl>
      )}

      {detailFields.map((field) => (
        <FormControl key={field.name}>
          <FormControl.Label>{field.label}</FormControl.Label>
          <TextInput
            value={values[field.name]}
            onChange={setField(field.name)}
            type={field.type === "number" ? "number" : "text"}
            min={field.type === "number" ? 0 : undefined}
            step={field.type === "number" ? "any" : undefined}
            block
            disabled={disabled}
          />
        </FormControl>
      ))}

      <FormControl>
        <FormControl.Label>Descrição</FormControl.Label>
        <Textarea
          value={values.description}
          onChange={setField("description")}
          block
          disabled={disabled}
        />
      </FormControl>
    </>
  );
}

function CatalogSearch({ onPickModel, onPickName, onPickManual, disabled }) {
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState(emptyCatalog);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    let isCurrentRequest = true;

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          "/api/v1/equipment-catalog?q=" + encodeURIComponent(query),
        );
        if (!response.ok) {
          throw new Error("Falha na busca.");
        }
        const body = await response.json();
        if (isCurrentRequest) {
          setCatalog(body);
          setSearchError(false);
        }
      } catch {
        if (isCurrentRequest) {
          setCatalog(emptyCatalog);
          setSearchError(true);
        }
      }
    }, 200);

    return () => {
      isCurrentRequest = false;
      clearTimeout(timeout);
    };
  }, [query]);

  const trimmedQuery = query.trim();

  return (
    <FormControl>
      <FormControl.Label>Buscar equipamento</FormControl.Label>
      <TextInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        leadingVisual={SearchIcon}
        placeholder="Ex.: compressor, gerador, caldeira"
        autoFocus
        block
        disabled={disabled}
      />
      <FormControl.Caption>
        Escolha um equipamento da lista para preencher os dados, ou insira
        manualmente.
      </FormControl.Caption>
      <div className={styles.results}>
        <ActionList>
          {searchError && (
            <ActionList.Item disabled>
              Não foi possível buscar no catálogo.
            </ActionList.Item>
          )}
          {catalog.models.length > 0 && (
            <ActionList.Group>
              <ActionList.GroupHeading as="h4">
                Equipamentos padrão
              </ActionList.GroupHeading>
              {catalog.models.map((entry) => (
                <ActionList.Item
                  key={entry.id}
                  onSelect={() => onPickModel(entry)}
                >
                  {entry.name} {entry.brand} {entry.model}
                  <ActionList.Description>
                    {[
                      entry.category,
                      entry.power && "potência " + entry.power,
                      entry.capacity && "capacidade " + entry.capacity,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </ActionList.Description>
                </ActionList.Item>
              ))}
            </ActionList.Group>
          )}
          {catalog.names.length > 0 && (
            <ActionList.Group>
              <ActionList.GroupHeading as="h4">
                Tipos de equipamento
              </ActionList.GroupHeading>
              {catalog.names.map((entry) => (
                <ActionList.Item
                  key={entry.id}
                  onSelect={() => onPickName(entry)}
                >
                  {entry.name}
                  <ActionList.Description>
                    {entry.category}
                  </ActionList.Description>
                </ActionList.Item>
              ))}
            </ActionList.Group>
          )}
          <ActionList.Item onSelect={() => onPickManual(trimmedQuery)}>
            {trimmedQuery
              ? 'Nenhum desses: inserir "' + trimmedQuery + '" manualmente'
              : "Nenhum desses: inserir manualmente"}
          </ActionList.Item>
        </ActionList>
      </div>
    </FormControl>
  );
}

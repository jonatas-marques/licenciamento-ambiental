import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  FormControl,
  Heading,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { Card } from "@primer/react/experimental";
import { PencilIcon, PlusIcon } from "@primer/octicons-react";
import styles from "./index.module.css";

export default function ResourceManagement({
  title,
  description,
  resourceName,
  pluralName,
  article,
  firstOrdinal,
  emptyTitle,
  emptyDescription,
  fields,
  endpoint,
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [items, setItems] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadItems() {
      setLoadingStatus("loading");
      setErrorMessage(null);

      try {
        const response = await fetch(endpoint);
        const responseBody = await response.json();

        if (!response.ok) {
          throw new Error(
            `${responseBody.message} ${responseBody.action}`.trim(),
          );
        }

        if (!Array.isArray(responseBody)) {
          throw new Error("A resposta da API possui um formato inválido.");
        }

        if (isCurrentRequest) {
          setItems(responseBody);
          setLoadingStatus("success");
        }
      } catch (error) {
        if (isCurrentRequest) {
          setErrorMessage(
            error.message || `Não foi possível carregar ${pluralName}.`,
          );
          setLoadingStatus("failure");
        }
      }
    }

    loadItems();

    return () => {
      isCurrentRequest = false;
    };
  }, [endpoint, pluralName]);

  return (
    <Stack gap="spacious">
      <div className={styles.pageHeader}>
        <div>
          <Heading as="h1">{title}</Heading>
          <Text className={styles.description}>{description}</Text>
        </div>
        <Button
          leadingVisual={PlusIcon}
          variant="primary"
          onClick={() => setIsCreating((current) => !current)}
          aria-expanded={isCreating}
        >
          Criar {resourceName}
        </Button>
      </div>

      <Banner
        title="Ações disponíveis em breve"
        description={`A criação e a edição de ${pluralName} serão conectadas às APIs em uma próxima etapa.`}
      />

      {isCreating && (
        <Card>
          <Stack gap="normal">
            <Heading as="h2">
              Novo {article} {resourceName.toLowerCase()}
            </Heading>
            {fields.map((field) => (
              <FormControl key={field.name}>
                <FormControl.Label>{field.label}</FormControl.Label>
                <TextInput
                  type={field.type || "text"}
                  placeholder={field.placeholder}
                  block
                  disabled
                />
              </FormControl>
            ))}
            <div className={styles.formActions}>
              <Button onClick={() => setIsCreating(false)}>Cancelar</Button>
              <Button variant="primary" disabled>
                Salvar
              </Button>
            </div>
          </Stack>
        </Card>
      )}

      {loadingStatus === "loading" && <Text>Carregando {pluralName}...</Text>}

      {loadingStatus === "failure" && (
        <Banner
          variant="critical"
          title="Não foi possível carregar"
          description={errorMessage}
        />
      )}

      {loadingStatus === "success" && items.length === 0 ? (
        <section className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <PlusIcon size={24} />
          </div>
          <Heading as="h2">{emptyTitle}</Heading>
          <Text>{emptyDescription}</Text>
          <Button
            variant="primary"
            leadingVisual={PlusIcon}
            onClick={() => setIsCreating(true)}
          >
            Criar {firstOrdinal} {resourceName.toLowerCase()}
          </Button>
        </section>
      ) : loadingStatus === "success" ? (
        <Stack gap="normal">
          <Heading as="h2">Itens vinculados à sua conta</Heading>
          {items.map((item) => (
            <Card key={item.id}>
              <Card.Heading>{item.name}</Card.Heading>
              {fields
                .filter((field) => field.name !== "name" && item[field.name])
                .map((field) => (
                  <Card.Description key={field.name}>
                    {field.label}: {item[field.name]}
                  </Card.Description>
                ))}
              {item.description && (
                <Card.Description>{item.description}</Card.Description>
              )}
              {item.detail && <Text>{item.detail}</Text>}
              <Card.Action>
                <Button
                  size="small"
                  leadingVisual={PencilIcon}
                  disabled
                  aria-label={`Editar ${item.name}`}
                >
                  Editar
                </Button>
              </Card.Action>
            </Card>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

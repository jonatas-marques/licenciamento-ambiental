import {
  Banner,
  Button,
  FormControl,
  Heading,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { Blankslate, Card } from "@primer/react/experimental";
import { PencilIcon, PlusIcon } from "@primer/octicons-react";
import Link from "next/link";
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
  items,
  loadingStatus,
  errorMessage,
  canCreate,
  isCreating,
  onCreateClick,
  onCancelCreate,
  onSubmit,
  formValues,
  onFieldChange,
  submitStatus,
  submitErrorMessage,
  successMessage,
  actionsMessage,
  getEditHref,
}) {
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
          onClick={onCreateClick}
          disabled={!canCreate}
          aria-expanded={isCreating}
        >
          Criar {resourceName}
        </Button>
      </div>

      {actionsMessage && (
        <Banner
          title="Ações disponíveis em breve"
          description={actionsMessage}
        />
      )}

      {isCreating && (
        <Card>
          <form onSubmit={onSubmit}>
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
                    maxLength={field.maxLength}
                    inputMode={field.inputMode}
                    value={formValues[field.name] ?? ""}
                    onChange={(event) =>
                      onFieldChange(field.name, event.target.value)
                    }
                    required={field.required !== false}
                    disabled={submitStatus === "loading"}
                  />
                </FormControl>
              ))}
              {submitErrorMessage && (
                <Banner
                  variant="critical"
                  title="Não foi possível criar"
                  description={submitErrorMessage}
                />
              )}
              <div className={styles.formActions}>
                <Button
                  type="button"
                  onClick={onCancelCreate}
                  disabled={submitStatus === "loading"}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitStatus === "loading"}
                >
                  {submitStatus === "loading" ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </Stack>
          </form>
        </Card>
      )}

      {successMessage && (
        <Banner title="Cadastro realizado" description={successMessage} />
      )}

      {loadingStatus === "loading" && <Text>Carregando {pluralName}...</Text>}

      {loadingStatus === "failure" && (
        <Banner
          variant="critical"
          title="Não foi possível carregar"
          description={errorMessage}
        />
      )}

      {loadingStatus === "success" && items.length === 0 && (
        <Blankslate spacious border>
          <Blankslate.Heading>{emptyTitle}</Blankslate.Heading>
          <Blankslate.Description>{emptyDescription}</Blankslate.Description>
          {canCreate && (
            <Blankslate.PrimaryAction onClick={onCreateClick}>
              Criar {firstOrdinal} {resourceName.toLowerCase()}
            </Blankslate.PrimaryAction>
          )}
        </Blankslate>
      )}

      {loadingStatus === "success" && items.length > 0 && (
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
                  as={Link}
                  size="small"
                  leadingVisual={PencilIcon}
                  href={getEditHref(item)}
                  aria-label={`Editar ${item.name}`}
                >
                  Editar
                </Button>
              </Card.Action>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

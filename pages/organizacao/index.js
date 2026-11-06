import { useEffect, useState } from "react";
import ResourceManagement from "../../interface/ResourceManagement";
import DefaultLayout from "../../interface/DefaultLayout";

const organizationFields = [
  { name: "name", label: "Razão social" },
  {
    name: "cnpj",
    label: "CNPJ",
    placeholder: "00000000000000",
    maxLength: 14,
    inputMode: "numeric",
  },
];

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formValues, setFormValues] = useState({ name: "", cnpj: "" });
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitErrorMessage, setSubmitErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadOrganizations() {
      try {
        const response = await fetch("/api/v1/persons/legal");
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
          setOrganizations(responseBody);
          setLoadingStatus("success");
        }
      } catch (error) {
        if (isCurrentRequest) {
          setErrorMessage(
            error.message || "Não foi possível carregar as organizações.",
          );
          setLoadingStatus("failure");
        }
      }
    }

    loadOrganizations();

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  function openCreateForm() {
    setFormValues({ name: "", cnpj: "" });
    setSubmitErrorMessage(null);
    setSuccessMessage(null);
    setSubmitStatus("idle");
    setIsCreating(true);
  }

  async function handleCreateOrganization(event) {
    event.preventDefault();
    setSubmitStatus("loading");
    setSubmitErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/v1/persons/legal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formValues),
      });
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `${responseBody.message} ${responseBody.action}`.trim(),
        );
      }

      const createdOrganization = {
        ...formValues,
        ...responseBody,
      };

      setOrganizations((currentOrganizations) =>
        [...currentOrganizations, createdOrganization].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setIsCreating(false);
      setSubmitStatus("success");
      setSuccessMessage("A organização e seu vínculo de membro foram criados.");
    } catch (error) {
      setSubmitErrorMessage(
        error.message || "Não foi possível criar a organização.",
      );
      setSubmitStatus("failure");
    }
  }

  return (
    <DefaultLayout
      metadata={{
        title: "Organizações",
        description: "Gerencie as organizações das quais você participa",
      }}
    >
      <ResourceManagement
        title="Organizações"
        description="Acompanhe e gerencie as pessoas jurídicas das quais você faz parte."
        resourceName="organização"
        pluralName="organizações"
        article="a"
        firstOrdinal="primeira"
        emptyTitle="Nenhuma organização para exibir"
        emptyDescription="Crie sua primeira organização para gerenciar as pessoas jurídicas relacionadas aos projetos."
        fields={organizationFields}
        items={organizations}
        loadingStatus={loadingStatus}
        errorMessage={errorMessage}
        canCreate
        isCreating={isCreating}
        onCreateClick={() =>
          isCreating ? setIsCreating(false) : openCreateForm()
        }
        onCancelCreate={() => setIsCreating(false)}
        onSubmit={handleCreateOrganization}
        formValues={formValues}
        onFieldChange={(name, value) =>
          setFormValues((currentValues) => ({
            ...currentValues,
            [name]: value,
          }))
        }
        submitStatus={submitStatus}
        submitErrorMessage={submitErrorMessage}
        successMessage={successMessage}
        getEditHref={(organization) => `/organizacao/${organization.id}`}
      />
    </DefaultLayout>
  );
}

import { useEffect, useState } from "react";
import ResourceManagement from "../../interface/ResourceManagement";
import DefaultLayout from "../../interface/DefaultLayout";
import { useRouter } from "next/router";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formValues, setFormValues] = useState({ name: "" });
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitErrorMessage, setSubmitErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadProjects() {
      try {
        setLoadingStatus("loading");
        setErrorMessage(null);

        const response = await fetch("/api/v1/projects");
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
          setProjects(responseBody);
          setLoadingStatus("success");
        }
      } catch (error) {
        if (isCurrentRequest) {
          setErrorMessage(
            error.message || "Não foi possível carregar os projetos.",
          );
          setLoadingStatus("failure");
        }
      }
    }

    loadProjects();

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  function openCreateForm() {
    setFormValues({ name: "" });
    setSubmitErrorMessage(null);
    setSuccessMessage(null);
    setSubmitStatus("idle");
    setIsCreating(true);
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    setSubmitStatus("loading");
    setSubmitErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/v1/projects", {
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

      setProjects((currentProjects) =>
        [...currentProjects, responseBody].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setIsCreating(false);
      setSubmitStatus("success");
      setSuccessMessage(
        "O projeto foi criado e já está disponível na sua lista.",
      );
    } catch (error) {
      setSubmitErrorMessage(
        error.message || "Não foi possível criar o projeto.",
      );
      setSubmitStatus("failure");
    }
  }

  return (
    <DefaultLayout
      metadata={{
        title: "Projetos",
        description: "Gerencie os projetos dos quais você participa",
      }}
    >
      <ResourceManagement
        title="Projetos"
        description="Acompanhe e gerencie os projetos dos quais você faz parte."
        resourceName="projeto"
        pluralName="projetos"
        article="o"
        firstOrdinal="primeiro"
        emptyTitle="Nenhum projeto para exibir"
        emptyDescription="Crie seu primeiro projeto para começar a organizar as informações do licenciamento."
        fields={[{ name: "name", label: "Nome do projeto" }]}
        items={projects}
        loadingStatus={loadingStatus}
        errorMessage={errorMessage}
        canCreate
        isCreating={isCreating}
        onCreateClick={() =>
          isCreating ? setIsCreating(false) : openCreateForm()
        }
        onCancelCreate={() => setIsCreating(false)}
        onSubmit={handleCreateProject}
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
        onEdit={(project) => router.push(`/projetos/${project.id}`)}
      />
    </DefaultLayout>
  );
}

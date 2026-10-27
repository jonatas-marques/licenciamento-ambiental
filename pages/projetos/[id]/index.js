import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  FormControl,
  Heading,
  Stack,
  Text,
  TextInput,
  useConfirm,
} from "@primer/react";
import { useRouter } from "next/router";
import DefaultLayout from "../../../interface/DefaultLayout";
import createProjectNavigation from "../../../interface/ProjectNavigation";

export default function ProjectDetailsPage() {
  const router = useRouter();
  const projectId = router.query.id;
  const [name, setName] = useState("");
  const [projectStatus, setProjectStatus] = useState("active");
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") {
      return;
    }

    let isCurrentRequest = true;

    async function loadProject() {
      try {
        setLoadingStatus("loading");
        setErrorMessage(null);

        const response = await fetch(`/api/v1/projects/${projectId}`);
        const responseBody = await response.json();

        if (!response.ok) {
          throw new Error(
            `${responseBody.message} ${responseBody.action}`.trim(),
          );
        }

        if (isCurrentRequest) {
          setName(responseBody.name);
          setProjectStatus(responseBody.status);
          setLoadingStatus("success");
        }
      } catch (error) {
        if (isCurrentRequest) {
          setErrorMessage(
            error.message || "Não foi possível carregar o projeto.",
          );
          setLoadingStatus("failure");
        }
      }
    }

    loadProject();

    return () => {
      isCurrentRequest = false;
    };
  }, [router.isReady, projectId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitStatus("loading");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `${responseBody.message} ${responseBody.action}`.trim(),
        );
      }

      await router.push("/projetos");
    } catch (error) {
      setErrorMessage(error.message || "Não foi possível atualizar o projeto.");
      setSubmitStatus("failure");
    }
  }

  async function handleArchive() {
    const confirmed = await confirm({
      title: "Arquivar projeto?",
      content:
        "O projeto continuará disponível na lista, identificado como arquivado.",
      confirmButtonContent: "Arquivar projeto",
      confirmButtonType: "danger",
      cancelButtonContent: "Cancelar",
    });

    if (!confirmed) {
      return;
    }

    setSubmitStatus("loading");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "archived" }),
      });
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `${responseBody.message} ${responseBody.action}`.trim(),
        );
      }

      setProjectStatus(responseBody.status);
      setSubmitStatus("success");
      setSuccessMessage("O projeto foi arquivado.");
    } catch (error) {
      setErrorMessage(error.message || "Não foi possível arquivar o projeto.");
      setSubmitStatus("failure");
    }
  }

  return (
    <DefaultLayout
      contentWidth="small"
      subNavigation={createProjectNavigation(projectId, "project")}
      metadata={{
        title: "Projeto",
        description: "Gerencie este projeto",
      }}
    >
      <Stack gap="spacious">
        {loadingStatus === "loading" && <Text>Carregando projeto...</Text>}

        {loadingStatus === "success" && (
          <Stack gap="normal">
            <Heading as="h1">{name}</Heading>
            <Text>
              Status: {projectStatus === "archived" ? "Arquivado" : "Ativo"}
            </Text>
            <Heading as="h2">Dados do projeto</Heading>
            <form onSubmit={handleSubmit}>
              <Stack gap="normal">
                <FormControl>
                  <FormControl.Label>Nome do projeto</FormControl.Label>
                  <TextInput
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={254}
                    block
                    disabled={submitStatus === "loading"}
                  />
                </FormControl>
                {errorMessage && (
                  <Banner
                    variant="critical"
                    title="Não foi possível atualizar"
                    description={errorMessage}
                  />
                )}
                {successMessage && (
                  <Banner
                    title="Alteração realizada"
                    description={successMessage}
                  />
                )}
                <div>
                  <Button
                    type="button"
                    onClick={() => router.push("/projetos")}
                    disabled={submitStatus === "loading"}
                  >
                    Cancelar
                  </Button>{" "}
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={submitStatus === "loading"}
                  >
                    {submitStatus === "loading" ? "Salvando..." : "Salvar"}
                  </Button>
                  {projectStatus === "active" && (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={handleArchive}
                      disabled={submitStatus === "loading"}
                    >
                      Arquivar projeto
                    </Button>
                  )}
                </div>
              </Stack>
            </form>
          </Stack>
        )}

        {loadingStatus === "failure" && (
          <Banner
            variant="critical"
            title="Não foi possível carregar"
            description={errorMessage}
          />
        )}
      </Stack>
    </DefaultLayout>
  );
}

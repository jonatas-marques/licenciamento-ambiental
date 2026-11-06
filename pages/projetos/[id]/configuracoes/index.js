import { useEffect, useState } from "react";
import { Banner, Heading, Stack, Text } from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { useRouter } from "next/router";
import DefaultLayout from "../../../../interface/DefaultLayout";
import createProjectNavigation from "../../../../interface/ProjectNavigation";

export default function ProjectSettingsPage() {
  const router = useRouter();
  const projectId = router.query.id;
  const [projectName, setProjectName] = useState("");
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") {
      return;
    }

    let isCurrentRequest = true;

    async function loadProject() {
      try {
        const response = await fetch(`/api/v1/projects/${projectId}`);
        const responseBody = await response.json();

        if (!response.ok) {
          throw new Error(
            `${responseBody.message} ${responseBody.action}`.trim(),
          );
        }

        if (isCurrentRequest) {
          setProjectName(responseBody.name);
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

  return (
    <DefaultLayout
      subNavigation={createProjectNavigation(projectId, "settings")}
      metadata={{
        title: "Configurações do projeto",
        description: "Configurações do projeto",
      }}
    >
      <Stack gap="spacious">
        {projectName && <Heading as="h1">{projectName}</Heading>}
        <Heading as="h2">Configurações</Heading>
        {loadingStatus === "loading" && <Text>Carregando projeto...</Text>}
        {loadingStatus === "failure" && (
          <Banner
            variant="critical"
            title="Não foi possível carregar"
            description={errorMessage}
          />
        )}
        {loadingStatus === "success" && (
          <Blankslate border>
            <Blankslate.Heading>
              Esta seção ainda está em definição
            </Blankslate.Heading>
            <Blankslate.Description>
              As opções de configuração do projeto serão decididas em uma
              próxima etapa.
            </Blankslate.Description>
          </Blankslate>
        )}
      </Stack>
    </DefaultLayout>
  );
}

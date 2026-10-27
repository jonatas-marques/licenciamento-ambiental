import { useEffect, useState } from "react";
import { Banner, Heading, Stack, Text } from "@primer/react";
import { useRouter } from "next/router";
import DefaultLayout from "../../../../../interface/DefaultLayout";
import createProjectNavigation from "../../../../../interface/ProjectNavigation";

export default function MceVersionPage() {
  const router = useRouter();
  const projectId = router.query.id;
  const mceId = router.query.mce_id;
  const [projectName, setProjectName] = useState("");
  const [version, setVersion] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (
      !router.isReady ||
      typeof projectId !== "string" ||
      typeof mceId !== "string"
    ) {
      return;
    }

    let isCurrentRequest = true;

    async function loadVersion() {
      try {
        const [projectResponse, versionResponse] = await Promise.all([
          fetch(`/api/v1/projects/${projectId}`),
          fetch(`/api/v1/projects/${projectId}/mces/${mceId}`),
        ]);
        const [projectBody, versionBody] = await Promise.all([
          projectResponse.json(),
          versionResponse.json(),
        ]);

        if (!projectResponse.ok) {
          throw new Error(
            `${projectBody.message} ${projectBody.action}`.trim(),
          );
        }
        if (!versionResponse.ok) {
          throw new Error(
            `${versionBody.message} ${versionBody.action}`.trim(),
          );
        }

        if (isCurrentRequest) {
          setProjectName(projectBody.name);
          setVersion(versionBody);
          setLoadingStatus("success");
        }
      } catch (error) {
        if (isCurrentRequest) {
          setErrorMessage(
            error.message || "Não foi possível carregar esta versão do MCE.",
          );
          setLoadingStatus("failure");
        }
      }
    }

    loadVersion();

    return () => {
      isCurrentRequest = false;
    };
  }, [router.isReady, projectId, mceId]);

  return (
    <DefaultLayout
      subNavigation={createProjectNavigation(projectId, "mce")}
      metadata={{
        title: version ? `MCE versão ${version.version}` : "MCE",
        description: "Versão do Memorial de Caracterização do Empreendimento",
      }}
    >
      <Stack gap="spacious">
        {projectName && <Heading as="h1">{projectName}</Heading>}
        {loadingStatus === "loading" && (
          <Text>Carregando versão do MCE...</Text>
        )}
        {loadingStatus === "failure" && (
          <Banner
            variant="critical"
            title="Não foi possível carregar"
            description={errorMessage}
          />
        )}
        {loadingStatus === "success" && version && (
          <Stack gap="normal">
            <Heading as="h2">MCE — versão {version.version}</Heading>
            <Text>
              Status: {version.status === "draft" ? "Rascunho" : "Arquivado"}
            </Text>
            <Text>Criado em {formatDate(version.created_at)}</Text>
            <Text>Atualizado em {formatDate(version.updated_at)}</Text>
            <Banner
              title="Estrutura inicial de versionamento"
              description="As seções técnicas do MCE serão adicionadas em etapas próprias. Esta versão e seu histórico já estão associados ao projeto."
            />
          </Stack>
        )}
      </Stack>
    </DefaultLayout>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

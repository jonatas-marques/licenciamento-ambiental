import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  Heading,
  Stack,
  Text,
  useConfirm,
} from "@primer/react";
import { Blankslate, Card } from "@primer/react/experimental";
import Link from "next/link";
import { useRouter } from "next/router";
import DefaultLayout from "../../../../interface/DefaultLayout";
import createProjectNavigation from "../../../../interface/ProjectNavigation";

export default function ProjectMcesPage() {
  const router = useRouter();
  const projectId = router.query.id;
  const [projectName, setProjectName] = useState("");
  const [versions, setVersions] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [actionStatus, setActionStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") {
      return;
    }

    let isCurrentRequest = true;

    async function loadMces() {
      try {
        const [projectResponse, mcesResponse, membersResponse, userResponse] =
          await Promise.all([
            fetch(`/api/v1/projects/${projectId}`),
            fetch(`/api/v1/projects/${projectId}/mces`),
            fetch(`/api/v1/projects/${projectId}/members`),
            fetch("/api/v1/user"),
          ]);
        const [projectBody, mcesBody, membersBody, userBody] =
          await Promise.all([
            projectResponse.json(),
            mcesResponse.json(),
            membersResponse.json(),
            userResponse.json(),
          ]);

        if (!projectResponse.ok) {
          throw new Error(
            `${projectBody.message} ${projectBody.action}`.trim(),
          );
        }
        if (!mcesResponse.ok) {
          throw new Error(`${mcesBody.message} ${mcesBody.action}`.trim());
        }
        if (!membersResponse.ok) {
          throw new Error(
            `${membersBody.message} ${membersBody.action}`.trim(),
          );
        }
        if (!userResponse.ok) {
          throw new Error(`${userBody.message} ${userBody.action}`.trim());
        }
        if (!Array.isArray(mcesBody) || !Array.isArray(membersBody)) {
          throw new Error("A resposta da API possui um formato inválido.");
        }

        if (isCurrentRequest) {
          const currentMembership = membersBody.find(
            (member) => member.user_id === userBody.id,
          );
          setProjectName(projectBody.name);
          setVersions(mcesBody);
          setCanManage(["owner", "admin"].includes(currentMembership?.role));
          setLoadingStatus("success");
        }
      } catch (error) {
        if (isCurrentRequest) {
          setErrorMessage(
            error.message || "Não foi possível carregar as versões do MCE.",
          );
          setLoadingStatus("failure");
        }
      }
    }

    loadMces();

    return () => {
      isCurrentRequest = false;
    };
  }, [router.isReady, projectId]);

  async function handleCreateDraft() {
    setActionStatus("loading");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/mces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `${responseBody.message} ${responseBody.action}`.trim(),
        );
      }

      await router.push(`/projetos/${projectId}/mce/${responseBody.id}`);
    } catch (error) {
      setErrorMessage(error.message || "Não foi possível criar o rascunho.");
      setActionStatus("failure");
    }
  }

  async function handleArchive(version) {
    const confirmed = await confirm({
      title: `Arquivar o rascunho da versão ${version.version}?`,
      content:
        "O histórico desta versão será preservado. Depois disso, será possível criar uma nova versão.",
      confirmButtonContent: "Arquivar rascunho",
      confirmButtonType: "danger",
      cancelButtonContent: "Cancelar",
    });

    if (!confirmed) {
      return;
    }

    setActionStatus("loading");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/mces/${version.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "archived" }),
        },
      );
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `${responseBody.message} ${responseBody.action}`.trim(),
        );
      }

      setVersions((currentVersions) =>
        currentVersions.map((currentVersion) =>
          currentVersion.id === responseBody.id ? responseBody : currentVersion,
        ),
      );
      setSuccessMessage(
        `O rascunho da versão ${version.version} foi arquivado.`,
      );
      setActionStatus("success");
    } catch (error) {
      setErrorMessage(error.message || "Não foi possível arquivar o rascunho.");
      setActionStatus("failure");
    }
  }

  const hasDraft = versions.some((version) => version.status === "draft");

  return (
    <DefaultLayout
      subNavigation={createProjectNavigation(projectId, "mce")}
      metadata={{
        title: "MCE",
        description: "Versões do Memorial de Caracterização do Empreendimento",
      }}
    >
      <Stack gap="spacious">
        {projectName && <Heading as="h1">{projectName}</Heading>}
        <div>
          <Heading as="h2">
            Memorial de Caracterização do Empreendimento
          </Heading>
          <Text>Gerencie as versões do MCE deste projeto.</Text>
        </div>

        {canManage && (
          <Button
            variant="primary"
            onClick={handleCreateDraft}
            disabled={actionStatus === "loading" || hasDraft}
          >
            {actionStatus === "loading" ? "Criando..." : "Criar rascunho"}
          </Button>
        )}

        {hasDraft && (
          <Banner
            title="Já existe um rascunho"
            description="Para iniciar outra versão, arquive o rascunho atual. O histórico será mantido."
          />
        )}

        {errorMessage && loadingStatus !== "failure" && (
          <Banner
            variant="critical"
            title="Não foi possível concluir a ação"
            description={errorMessage}
          />
        )}
        {successMessage && (
          <Banner title="Ação realizada" description={successMessage} />
        )}
        {loadingStatus === "loading" && (
          <Text>Carregando versões do MCE...</Text>
        )}
        {loadingStatus === "failure" && (
          <Banner
            variant="critical"
            title="Não foi possível carregar"
            description={errorMessage}
          />
        )}

        {loadingStatus === "success" && versions.length === 0 && (
          <Blankslate border>
            <Blankslate.Heading>Nenhuma versão de MCE</Blankslate.Heading>
            <Blankslate.Description>
              Crie um rascunho para iniciar o histórico de versões deste
              projeto.
            </Blankslate.Description>
            {canManage && (
              <Blankslate.PrimaryAction
                onClick={handleCreateDraft}
                disabled={actionStatus === "loading"}
              >
                Criar rascunho
              </Blankslate.PrimaryAction>
            )}
          </Blankslate>
        )}

        {loadingStatus === "success" && versions.length > 0 && (
          <Stack gap="normal">
            {versions.map((version) => (
              <Card key={version.id}>
                <Card.Heading>Versão {version.version}</Card.Heading>
                <Card.Description>
                  Status:{" "}
                  {version.status === "draft" ? "Rascunho" : "Arquivado"}
                </Card.Description>
                <Card.Description>
                  Criada em {formatDate(version.created_at)}
                </Card.Description>
                <Card.Action>
                  <Button
                    as={Link}
                    size="small"
                    href={`/projetos/${projectId}/mce/${version.id}`}
                  >
                    Abrir versão
                  </Button>
                  {canManage && version.status === "draft" && (
                    <Button
                      size="small"
                      variant="danger"
                      onClick={() => handleArchive(version)}
                      disabled={actionStatus === "loading"}
                    >
                      Arquivar rascunho
                    </Button>
                  )}
                </Card.Action>
              </Card>
            ))}
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

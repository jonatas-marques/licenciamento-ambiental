import { useEffect, useState } from "react";
import { Banner, Button, Heading, Stack, Text } from "@primer/react";
import Link from "next/link";
import { Blankslate } from "@primer/react/experimental";
import { useRouter } from "next/router";
import DefaultLayout from "../../../../interface/DefaultLayout";
import createProjectNavigation from "../../../../interface/ProjectNavigation";

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  return { response, body };
}

function toMessage(body) {
  return `${body.message} ${body.action}`.trim();
}

export default function ProjectMcePage() {
  const router = useRouter();
  const projectId = router.query.id;
  const [projectName, setProjectName] = useState("");
  const [mce, setMce] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") {
      return;
    }

    let isCurrentRequest = true;
    const baseUrl = `/api/v1/projects/${projectId}`;

    async function load() {
      try {
        const [project, members, user, mceResult] = await Promise.all([
          fetchJson(baseUrl),
          fetchJson(`${baseUrl}/members`),
          fetchJson("/api/v1/user"),
          fetchJson(`${baseUrl}/mce`),
        ]);

        for (const { response, body } of [project, members, user]) {
          if (!response.ok) {
            throw new Error(toMessage(body));
          }
        }

        let loadedMce = null;

        if (mceResult.response.ok) {
          loadedMce = mceResult.body;
        } else if (mceResult.response.status !== 404) {
          throw new Error(toMessage(mceResult.body));
        }

        if (isCurrentRequest) {
          const membership = members.body.find(
            (member) => member.user_id === user.body.id,
          );
          setProjectName(project.body.name);
          setCanEdit(["owner", "admin", "member"].includes(membership?.role));
          setMce(loadedMce);
          setLoadingStatus("success");
        }
      } catch (error) {
        if (isCurrentRequest) {
          setErrorMessage(error.message || "Não foi possível carregar o MCE.");
          setLoadingStatus("failure");
        }
      }
    }

    load();

    return () => {
      isCurrentRequest = false;
    };
  }, [router.isReady, projectId]);

  async function saveMce(method, body) {
    setIsSaving(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/mce`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(toMessage(responseBody));
      }

      setMce(responseBody);
    } catch (error) {
      setActionError(error.message || "Não foi possível salvar o MCE.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DefaultLayout
      subNavigation={createProjectNavigation(projectId, "mce")}
      metadata={{
        title: "MCE - Memorial de Caracterização do Empreendimento",
        description:
          "Gerenciar o MCE - Memorial de Caracterização do Empreendimento",
      }}
    >
      <Stack gap="spacious">
        {projectName && <Heading as="h1">{projectName}</Heading>}
        {loadingStatus === "loading" && <Text>Carregando MCE...</Text>}
        {loadingStatus === "failure" && (
          <Banner
            variant="critical"
            title="Não foi possível carregar"
            description={errorMessage}
          />
        )}
        {actionError && (
          <Banner
            variant="critical"
            title="Não foi possível concluir a alteração"
            description={actionError}
          />
        )}

        {loadingStatus === "success" && !mce && (
          <Blankslate border>
            <Blankslate.Heading>
              Este projeto ainda não possui MCE
            </Blankslate.Heading>
            <Blankslate.Description>
              Crie o Memorial de Caracterização do Empreendimento para cadastrar
              fluxogramas e equipamentos.
            </Blankslate.Description>
            {canEdit && (
              <Blankslate.PrimaryAction
                onClick={() => saveMce("POST")}
                disabled={isSaving}
              >
                Criar MCE
              </Blankslate.PrimaryAction>
            )}
          </Blankslate>
        )}

        {loadingStatus === "success" && mce && (
          <>
            <div className="project-section-heading">
              <div>
                <Heading as="h2">Memorial de Caracterização</Heading>
                <Text>
                  Situação:{" "}
                  {mce.status === "completed" ? "Concluído" : "Rascunho"}
                </Text>
              </div>
              {canEdit && (
                <Button
                  onClick={() =>
                    saveMce("PATCH", {
                      status:
                        mce.status === "completed" ? "draft" : "completed",
                    })
                  }
                  disabled={isSaving}
                >
                  {mce.status === "completed"
                    ? "Reabrir como rascunho"
                    : "Marcar como concluído"}
                </Button>
              )}
            </div>
            <Stack gap="condensed">
              <Text>
                <Link href={`/projetos/${projectId}/mce/fluxogramas`}>
                  Fluxogramas
                </Link>
                : processos produtivos do empreendimento.
              </Text>
              <Text>
                <Link href={`/projetos/${projectId}/mce/equipamentos`}>
                  Equipamentos
                </Link>
                : equipamentos utilizados pelo empreendimento.
              </Text>
            </Stack>
          </>
        )}
      </Stack>
    </DefaultLayout>
  );
}

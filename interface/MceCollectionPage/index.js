import { useEffect, useState } from "react";
import { Banner, Heading, Stack, Text } from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import Link from "next/link";
import { useRouter } from "next/router";
import DefaultLayout from "../DefaultLayout";
import MceItemSection from "../MceItemSection";
import createProjectNavigation from "../ProjectNavigation";

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  return { response, body };
}

function toMessage(body) {
  return `${body.message} ${body.action}`.trim();
}

// Tela de edição de uma coleção do MCE (fluxogramas, equipamentos...).
export default function MceCollectionPage({
  section,
  collection,
  title,
  description,
  singular,
  fields,
  columns,
  renderFormFields,
}) {
  const router = useRouter();
  const projectId = router.query.id;
  const [projectName, setProjectName] = useState("");
  const [hasMce, setHasMce] = useState(false);
  const [items, setItems] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") {
      return;
    }

    let isCurrentRequest = true;
    const baseUrl = `/api/v1/projects/${projectId}`;

    async function load() {
      try {
        const [project, members, user, mce] = await Promise.all([
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

        let loadedItems = [];

        const mceExists = mce.response.ok;

        if (mceExists) {
          const list = await fetchJson(`${baseUrl}/mce/${collection}`);
          if (!list.response.ok) {
            throw new Error(toMessage(list.body));
          }
          loadedItems = list.body;
        } else if (mce.response.status !== 404) {
          throw new Error(toMessage(mce.body));
        }

        if (isCurrentRequest) {
          const membership = members.body.find(
            (member) => member.user_id === user.body.id,
          );
          setProjectName(project.body.name);
          setCanEdit(["owner", "admin", "member"].includes(membership?.role));
          setHasMce(mceExists);
          setItems(loadedItems);
          setLoadingStatus("success");
        }
      } catch (error) {
        if (isCurrentRequest) {
          setErrorMessage(error.message || "Não foi possível carregar a tela.");
          setLoadingStatus("failure");
        }
      }
    }

    load();

    return () => {
      isCurrentRequest = false;
    };
  }, [router.isReady, projectId, collection]);

  return (
    <DefaultLayout
      subNavigation={createProjectNavigation(projectId, section)}
      metadata={{ title, description }}
    >
      <Stack gap="spacious">
        {projectName && <Heading as="h1">{projectName}</Heading>}
        {loadingStatus === "loading" && <Text>Carregando...</Text>}
        {loadingStatus === "failure" && (
          <Banner
            variant="critical"
            title="Não foi possível carregar"
            description={errorMessage}
          />
        )}
        {loadingStatus === "success" && !hasMce && (
          <Blankslate border>
            <Blankslate.Heading>
              Este projeto ainda não possui MCE
            </Blankslate.Heading>
            <Blankslate.Description>
              Crie o MCE para cadastrar {title.toLowerCase()}.
            </Blankslate.Description>
            <Blankslate.PrimaryAction
              as={Link}
              href={`/projetos/${projectId}/mce`}
            >
              Ir para o MCE
            </Blankslate.PrimaryAction>
          </Blankslate>
        )}
        {loadingStatus === "success" && hasMce && (
          <MceItemSection
            projectId={projectId}
            collection={collection}
            title={title}
            description={description}
            singular={singular}
            fields={fields}
            columns={columns}
            renderFormFields={renderFormFields}
            items={items}
            onItemsChange={setItems}
            canEdit={canEdit}
          />
        )}
      </Stack>
    </DefaultLayout>
  );
}

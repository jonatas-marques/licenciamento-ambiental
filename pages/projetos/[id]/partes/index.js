import { useEffect, useState } from "react";
import { Banner, Heading, Stack, Text } from "@primer/react";
import { Blankslate, Card } from "@primer/react/experimental";
import { useRouter } from "next/router";
import DefaultLayout from "../../../../interface/DefaultLayout";
import createProjectNavigation from "../../../../interface/ProjectNavigation";

export default function ProjectPartiesPage() {
  const router = useRouter();
  const projectId = router.query.id;
  const [projectName, setProjectName] = useState("");
  const [parties, setParties] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") {
      return;
    }

    let isCurrentRequest = true;

    async function loadProjectParties() {
      try {
        const [projectResponse, partiesResponse] = await Promise.all([
          fetch(`/api/v1/projects/${projectId}`),
          fetch(`/api/v1/projects/${projectId}/parties`),
        ]);
        const [projectBody, partiesBody] = await Promise.all([
          projectResponse.json(),
          partiesResponse.json(),
        ]);

        if (!projectResponse.ok) {
          throw new Error(
            `${projectBody.message} ${projectBody.action}`.trim(),
          );
        }
        if (!partiesResponse.ok) {
          throw new Error(
            `${partiesBody.message} ${partiesBody.action}`.trim(),
          );
        }
        if (!Array.isArray(partiesBody)) {
          throw new Error("A resposta da API possui um formato inválido.");
        }

        if (isCurrentRequest) {
          setProjectName(projectBody.name);
          setParties(partiesBody);
          setLoadingStatus("success");
        }
      } catch (error) {
        if (isCurrentRequest) {
          setErrorMessage(
            error.message || "Não foi possível carregar as partes.",
          );
          setLoadingStatus("failure");
        }
      }
    }

    loadProjectParties();

    return () => {
      isCurrentRequest = false;
    };
  }, [router.isReady, projectId]);

  return (
    <DefaultLayout
      subNavigation={createProjectNavigation(projectId, "parties")}
      metadata={{
        title: "Partes interessadas",
        description: "Consulte as partes interessadas neste projeto",
      }}
    >
      <Stack gap="spacious">
        {projectName && <Heading as="h1">{projectName}</Heading>}
        <div>
          <Heading as="h2">Partes interessadas</Heading>
          <Text>Pessoas físicas ou jurídicas com interesse neste projeto.</Text>
        </div>
        {loadingStatus === "loading" && (
          <Text>Carregando partes interessadas...</Text>
        )}
        {loadingStatus === "failure" && (
          <Banner
            variant="critical"
            title="Não foi possível carregar"
            description={errorMessage}
          />
        )}
        {loadingStatus === "success" && parties.length === 0 && (
          <Blankslate border>
            <Blankslate.Heading>
              Nenhuma parte interessada cadastrada
            </Blankslate.Heading>
            <Blankslate.Description>
              Consultorias, responsáveis legais e outras pessoas com interesse
              no projeto aparecerão aqui.
            </Blankslate.Description>
          </Blankslate>
        )}
        {loadingStatus === "success" && parties.length > 0 && (
          <Stack gap="normal">
            {parties.map((party) => (
              <Card key={party.id}>
                <Card.Heading>{formatPersonCp(party.person_cp)}</Card.Heading>
                <Card.Description>Interesse: {party.interest}</Card.Description>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </DefaultLayout>
  );
}

function formatPersonCp(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (digits.length === 14) {
    return digits.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }

  return value;
}

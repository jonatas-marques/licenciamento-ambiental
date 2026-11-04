import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  Button,
  FormControl,
  Heading,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { useRouter } from "next/router";
import DefaultLayout from "../../../interface/DefaultLayout";
import createProjectNavigation from "../../../interface/ProjectNavigation";

export default function ProjectDetailsPage() {
  const router = useRouter();
  const projectId = router.query.id;
  const [name, setName] = useState("");
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);

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

  return (
    <DefaultLayout
      subNavigation={createProjectNavigation(projectId, "project")}
      metadata={{
        title: "Projeto",
        description: "Gerencie este projeto",
      }}
    >
      <Stack gap="spacious">
        <Heading as="h1">{name}</Heading>
        {loadingStatus === "loading" && <Text>Carregando projeto...</Text>}

        {loadingStatus === "success" && (
          <>
            <ProjectDataSection
              name={name}
              handleSubmit={handleSubmit}
              setName={setName}
              submitStatus={submitStatus}
              errorMessage={errorMessage}
              onCancel={() => router.push("/projetos")}
            />
            <ProjectPartySection projectId={projectId} />
          </>
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

function ProjectDataSection({
  name,
  handleSubmit,
  setName,
  submitStatus,
  errorMessage,
  onCancel,
}) {
  return (
    <Stack gap="normal">
      <Heading as="h2">Dados do projeto</Heading>
      <form onSubmit={handleSubmit}>
        <Stack gap="normal">
          <FormControl required>
            <FormControl.Label>Nome do projeto</FormControl.Label>
            <TextInput
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
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
          <div>
            <Button
              type="button"
              onClick={onCancel}
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
          </div>
        </Stack>
      </form>
    </Stack>
  );
}

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`${body.message} ${body.action}`.trim());
  }

  return body;
}

function formatCpfCnpj(value) {
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

function ProjectPartySection({ projectId }) {
  const baseUrl = `/api/v1/projects/${projectId}/parties`;
  const [parties, setParties] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [personDocument, setPersonDocument] = useState("");
  const [interest, setInterest] = useState("");

  const loadParties = useCallback(async () => {
    try {
      setParties(await request(baseUrl));
      setLoadingStatus("success");
    } catch (error) {
      setErrorMessage(error.message);
      setLoadingStatus("failure");
    }
  }, [baseUrl]);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  function resetForm() {
    setEditingId(null);
    setPersonDocument("");
    setInterest("");
  }

  function startEditing(party) {
    setErrorMessage(null);
    setEditingId(party.id);
    setPersonDocument(party.person_document);
    setInterest(party.interest);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage(null);

    try {
      await request(editingId ? `${baseUrl}/${editingId}` : baseUrl, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_document: personDocument, interest }),
      });
      resetForm();
      await loadParties();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(party) {
    if (
      !window.confirm(`Remover ${party.person_name ?? party.person_document}?`)
    ) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      await request(`${baseUrl}/${party.id}`, { method: "DELETE" });
      if (editingId === party.id) {
        resetForm();
      }
      await loadParties();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="normal">
      <Heading as="h2">Partes interessadas</Heading>

      {loadingStatus === "loading" && <Text>Carregando...</Text>}

      {loadingStatus === "success" && (
        <>
          {parties.length === 0 ? (
            <Text>Nenhuma parte interessada cadastrada.</Text>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th>Nome</th>
                  <th>CPF/CNPJ</th>
                  <th>Interesse</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {parties.map((party) => (
                  <tr key={party.id}>
                    <td>{party.person_name ?? "—"}</td>
                    <td>{formatCpfCnpj(party.person_document)}</td>
                    <td>{party.interest}</td>
                    <td style={{ textAlign: "right" }}>
                      <Button
                        size="small"
                        disabled={busy}
                        onClick={() => startEditing(party)}
                      >
                        Alterar
                      </Button>{" "}
                      <Button
                        size="small"
                        variant="danger"
                        disabled={busy}
                        onClick={() => handleRemove(party)}
                      >
                        Remover
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <form onSubmit={handleSubmit}>
            <Stack gap="normal">
              <Heading as="h3" variant="medium">
                {editingId ? "Alterar parte interessada" : "Adicionar parte"}
              </Heading>
              <FormControl required>
                <FormControl.Label>CPF ou CNPJ</FormControl.Label>
                <TextInput
                  value={personDocument}
                  onChange={(event) => setPersonDocument(event.target.value)}
                  block
                  disabled={busy}
                />
              </FormControl>
              <FormControl required>
                <FormControl.Label>Interesse</FormControl.Label>
                <FormControl.Caption>
                  Use &ldquo;responsável legal&rdquo; ou &ldquo;consultoria
                  ambiental&rdquo; para acesso total ao projeto.
                </FormControl.Caption>
                <TextInput
                  value={interest}
                  onChange={(event) => setInterest(event.target.value)}
                  maxLength={32}
                  block
                  disabled={busy}
                />
              </FormControl>
              <div>
                {editingId && (
                  <>
                    <Button type="button" onClick={resetForm} disabled={busy}>
                      Cancelar
                    </Button>{" "}
                  </>
                )}
                <Button type="submit" variant="primary" disabled={busy}>
                  {editingId ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </Stack>
          </form>
        </>
      )}

      {errorMessage && (
        <Banner
          variant="critical"
          title="Não foi possível concluir"
          description={errorMessage}
        />
      )}
    </Stack>
  );
}

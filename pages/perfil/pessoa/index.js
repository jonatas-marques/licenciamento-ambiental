import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  FormControl,
  Heading,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import DefaultLayout from "../../../interface/DefaultLayout";
import { useRouter } from "next/router";

export default function ProfilePersonPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [person, setPerson] = useState(null);
  const [name, setName] = useState("");
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const userResponse = await fetch("/api/v1/user");
        const userResponseBody = await userResponse.json();

        if (!userResponse.ok) {
          throw new Error(
            `${userResponseBody.message} ${userResponseBody.action}`,
          );
        }

        setUser(userResponseBody);

        const personResponse = await fetch("/api/v1/person");
        const personResponseBody = await personResponse.json();

        if (personResponse.status === 404) {
          setLoadingStatus("success");
          return;
        }

        if (!personResponse.ok) {
          throw new Error(
            `${personResponseBody.message} ${personResponseBody.action}`,
          );
        }

        setPerson(personResponseBody);
        setName(personResponseBody.name);
        setLoadingStatus("success");
      } catch (error) {
        setErrorMessage(
          error.message || "Não foi possível carregar os dados pessoais.",
        );
        setLoadingStatus("failure");
      }
    }

    loadProfile();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch(
        person
          ? `/api/v1/persons/natural/${person.id}`
          : "/api/v1/persons/natural",
        {
          method: person ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            ...(!person && { cpf: user.cpf }),
          }),
        },
      );
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(`${responseBody.message} ${responseBody.action}`);
      }

      await router.push("/perfil");
    } catch (error) {
      setErrorMessage(
        error.message || "Não foi possível atualizar os dados pessoais.",
      );
      setSubmitStatus("failure");
    }
  }

  return (
    <DefaultLayout
      contentWidth="small"
      metadata={{
        title: "Dados pessoais",
        description: "Atualize seus dados pessoais",
      }}
    >
      <Stack gap="spacious">
        <Heading as="h1">Dados pessoais</Heading>
        {loadingStatus === "loading" && <Text>Carregando...</Text>}
        {loadingStatus === "success" && user && (
          <form onSubmit={handleSubmit}>
            <Stack gap="normal">
              <FormControl>
                <FormControl.Label>Nome</FormControl.Label>
                <TextInput
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  block
                />
              </FormControl>
              <FormControl>
                <FormControl.Label>CPF</FormControl.Label>
                <TextInput
                  type="text"
                  value={formatCpf(person?.cpf || user.cpf)}
                  readOnly
                  block
                />
              </FormControl>
              <Stack.Item>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitStatus === "loading"}
                >
                  Salvar
                </Button>
              </Stack.Item>
            </Stack>
          </form>
        )}
        {errorMessage && (
          <Banner
            variant="critical"
            title="Erro"
            hideTitle
            description={errorMessage}
          />
        )}
      </Stack>
    </DefaultLayout>
  );
}

function formatCpf(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

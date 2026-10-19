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

export default function ProfileEmailPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/api/v1/user");
        const responseBody = await response.json();

        if (!response.ok) {
          throw new Error(`${responseBody.message} ${responseBody.action}`);
        }

        setUser(responseBody);
        setLoadingStatus("success");
      } catch (error) {
        setErrorMessage(
          error.message || "Não foi possível carregar os dados do usuário.",
        );
        setLoadingStatus("failure");
      }
    }

    loadUser();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(`${responseBody.message} ${responseBody.action}`);
      }

      await router.push("/perfil");
    } catch (error) {
      setErrorMessage(error.message || "Não foi possível atualizar o email.");
      setSubmitStatus("failure");
    }
  }

  return (
    <DefaultLayout
      contentWidth="small"
      metadata={{
        title: "Alterar email",
        description: "Atualize o email da sua conta",
      }}
    >
      <Stack gap="spacious">
        <Heading as="h1">Alterar email</Heading>
        {loadingStatus === "loading" && <Text>Carregando...</Text>}
        {loadingStatus === "success" && (
          <form onSubmit={handleSubmit}>
            <Stack gap="normal">
              <FormControl>
                <FormControl.Label>Novo email</FormControl.Label>
                <TextInput
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
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

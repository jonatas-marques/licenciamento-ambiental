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

export default function ProfilePasswordPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    setErrorMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage("A confirmação da nova senha não corresponde.");
      setSubmitStatus("failure");
      return;
    }

    setSubmitStatus("loading");

    try {
      const response = await fetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          password: newPassword,
        }),
      });
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(`${responseBody.message} ${responseBody.action}`);
      }

      await router.push("/perfil");
    } catch (error) {
      setErrorMessage(error.message || "Não foi possível atualizar a senha.");
      setSubmitStatus("failure");
    }
  }

  return (
    <DefaultLayout
      contentWidth="small"
      metadata={{
        title: "Alterar senha",
        description: "Atualize a senha da sua conta",
      }}
    >
      <Stack gap="spacious">
        <Heading as="h1">Alterar senha</Heading>
        {loadingStatus === "loading" && <Text>Carregando...</Text>}
        {loadingStatus === "success" && (
          <form onSubmit={handleSubmit}>
            <Stack gap="normal">
              <FormControl>
                <FormControl.Label>Senha Atual</FormControl.Label>
                <TextInput
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  block
                />
              </FormControl>
              <FormControl>
                <FormControl.Label>Nova Senha</FormControl.Label>
                <TextInput
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  block
                />
              </FormControl>
              <FormControl>
                <FormControl.Label>Nova Senha (confirmar)</FormControl.Label>
                <TextInput
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
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

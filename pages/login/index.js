import { useState } from "react";
import {
  Button,
  FormControl,
  TextInput,
  Stack,
  Heading,
  Banner,
} from "@primer/react";
import DefaultLayout from "../../interface/DefaultLayout";

export default function LoginPage() {
  return (
    <DefaultLayout
      contentWidth="small"
      metadata={{
        title: "Login",
        description: "Faça login na sua conta",
      }}
    >
      <Stack gap="spacious">
        <Heading as="h1">Login</Heading>

        <LoginForm />
      </Stack>
    </DefaultLayout>
  );
}

function formatCpf(value) {
  return value
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function LoginForm() {
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [loginStatus, setLoginStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoginStatus("loading");
    setErrorMessage(null);

    const requestBody = { cpf, password };

    let loginResponseBody = null;
    try {
      const response = await fetch("/api/v1/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      loginResponseBody = await response.json();

      if (response.status === 201) {
        setLoginStatus("success");
        location.href = "/";
        return;
      }
      setErrorMessage(
        `${loginResponseBody.message} ${loginResponseBody.action}`,
      );
      setLoginStatus("failure");
    } catch {
      setErrorMessage(
        "Não foi possível fazer login na sua conta. Tente novamente mais tarde.",
      );
      setLoginStatus("failure");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="normal">
        <FormControl>
          <FormControl.Label>CPF</FormControl.Label>
          <TextInput
            type="text"
            value={formatCpf(cpf)}
            onChange={(event) => {
              const digitsOnly = event.target.value
                .replace(/\D/g, "")
                .slice(0, 11);

              setCpf(digitsOnly);
            }}
            block
          />
        </FormControl>
        <FormControl>
          <FormControl.Label>Senha</FormControl.Label>

          <TextInput
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            block
          />
        </FormControl>
        <Stack.Item>
          <Button
            type="submit"
            variant="primary"
            disabled={loginStatus === "loading"}
          >
            Fazer login
          </Button>
        </Stack.Item>
        {errorMessage && (
          <Stack.Item>
            <Banner
              variant="critical"
              title="Critical"
              hideTitle
              description={errorMessage}
            />
          </Stack.Item>
        )}

        <Stack.Item>
          <span>
            Novo no EcoTab? <a href="/cadastro">Crie sua conta</a>.
          </span>
          <br></br>
          <span>
            Esqueceu sua senha? <a href="/cadastro/recuperar">Clique aqui</a>.
          </span>
        </Stack.Item>
      </Stack>
    </form>
  );
}

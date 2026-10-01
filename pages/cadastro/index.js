import { useState } from "react";
import { Button, FormControl, TextInput, Stack, Heading } from "@primer/react";
import DefaultLayout from "../../interface/DefaultLayout";

export default function RegisterPage() {
  return (
    <DefaultLayout
      contentWidth="small"
      metadata={{
        title: "Cadastro",
        description: "Crie sua conta de forma gratuita",
      }}
    >
      <Stack gap="spacious">
        <Heading as="h1">Cadastro</Heading>

        <RegisterForm />
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

function RegisterForm() {
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const requestBody = { cpf, email, password };

    const response = await fetch("/api/v1/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 201) {
      location.href = "/cadastro/confirmar";
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
              setCpf(event.target.value);
            }}
            block
          />
        </FormControl>
        <FormControl>
          <FormControl.Label>Email</FormControl.Label>

          <TextInput
            type="text"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
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
          <Button type="submit" variant="primary">
            Criar cadastro
          </Button>
        </Stack.Item>
      </Stack>
    </form>
  );
}

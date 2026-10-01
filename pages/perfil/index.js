import { useEffect, useState } from "react";
import {
  Button,
  FormControl,
  TextInput,
  Stack,
  Heading,
  Banner,
} from "@primer/react";
import DefaultLayout from "../../interface/DefaultLayout";

export default function ProfilePage() {
  const [cpf, setCpf] = useState("");

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/v1/user");
        if (!response.ok) {
          return;
        }
        const userData = await response.json();
        setCpf(userData.cpf ?? "");
      } catch {
        setCpf("");
      }
    }

    loadCurrentUser();
  }, []);

  return (
    <DefaultLayout
      contentWidth="small"
      metadata={{
        title: "Perfil",
        description: "Gerenciar seu perfil",
      }}
    >
      <Stack gap="spacious">
        <Heading as="h1">Editar Perfil</Heading>

        <ProfileForm cpf={cpf} />
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

function ProfileForm({ cpf }) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const email = "";
  const [phone, setPhone] = useState("");
  const password = "";
  const [loginStatus, setLoginStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoginStatus("loading");
    setErrorMessage(null);
    setSuccessMessage(null);

    const requestBody = { name, birthDate, cpf, email, phone, password };

    let loginResponseBody = null;
    try {
      const response = await fetch("/api/v1/persons/natural", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      loginResponseBody = await response.json();

      if (response.status === 201) {
        setLoginStatus("success");
        setSuccessMessage("Perfil atualizado com sucesso!");
        return;
      }
      setErrorMessage(
        `${loginResponseBody.message} ${loginResponseBody.action}`,
      );
      setLoginStatus("failure");
    } catch {
      setErrorMessage(
        "Não foi possível cadastrar a sua pessoa. Tente novamente mais tarde.",
      );
      setLoginStatus("failure");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="normal">
        <FormControl>
          <FormControl.Label>Nome</FormControl.Label>
          <TextInput
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            block
          />
        </FormControl>
        <FormControl>
          <FormControl.Label>CPF</FormControl.Label>
          <TextInput type="text" value={formatCpf(cpf)} readOnly block />
        </FormControl>
        <FormControl>
          <FormControl.Label>Data de nascimento</FormControl.Label>

          <TextInput
            type="date"
            value={birthDate}
            onChange={(event) => {
              setBirthDate(event.target.value);
            }}
            block
          />
        </FormControl>
        <FormControl>
          <FormControl.Label>Telefone</FormControl.Label>

          <TextInput
            type="text"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
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
            Salvar
          </Button>
        </Stack.Item>
        {successMessage && (
          <Stack.Item>
            <Banner
              variant="success"
              title="Success"
              hideTitle
              description={successMessage}
            />
          </Stack.Item>
        )}
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
      </Stack>
    </form>
  );
}

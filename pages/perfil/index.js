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
  const [currentUser, setCurrentUser] = useState(null);
  const [naturalPerson, setNaturalPerson] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    loadProfile();

    async function loadProfile() {
      try {
        setLoadingStatus("loading");
        setErrorMessage(null);

        // 1. Busca o usuário autenticado
        const userResponse = await fetch("/api/v1/user");

        // se resposta === 200
        if (userResponse.status === 200) {
          const userData = await userResponse.json();
          setCurrentUser(userData);
        }

        // Se não encontrar usuário, erly return
        if (userResponse.status === 404) {
          setCurrentUser(null);
          setNaturalPerson(null);
          setLoadingStatus("failure");
          return;
        }

        // 2. Procura uma pessoa física com o mesmo CPF
        let personData = null;
        const personResponse = await fetch("/api/v1/person");

        if (personResponse.status === 200) {
          personData = await personResponse.json();
          setNaturalPerson(personData);
        }

        // Não existe pessoa física com esse CPF
        if (personResponse.status === 404) {
          setNaturalPerson(null);
          setLoadingStatus("success");
          return;
        }

        setNaturalPerson(personData);
        setLoadingStatus("success");
      } catch (error) {
        setCurrentUser(null);
        setNaturalPerson(null);
        setLoadingStatus("failure");
        setErrorMessage(error.message || "Não foi possível carregar o perfil.");
      }
    }
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
        <Heading as="h1">Editar perfil</Heading>

        {loadingStatus === "loading" && <p>Carregando...</p>}

        {loadingStatus === "success" && (
          <ProfileForm user={currentUser} person={naturalPerson} />
        )}

        {loadingStatus === "failure" && (
          <Banner
            variant="critical"
            title="Critical"
            hideTitle
            description={errorMessage || "Não foi possível carregar o perfil."}
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

// Pegar os dados de usuário e pessoa
// na função loadProfile, dentro do Hook useEffect,
// e passar para o ProfileForm
function ProfileForm({ user, person }) {
  const [name, setName] = useState(person?.name ?? "");
  const [cpf, setCpf] = useState(user?.cpf ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [editingStatus, setEditingStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // decidir metodo e url com base na existência de pessoa física
  const method = person ? "PATCH" : "POST";
  const url = person
    ? `/api/v1/persons/natural/${person.id}`
    : "/api/v1/persons/natural";

  const requestBody = {
    name,
    cpf,
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setEditingStatus("loading");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const editingResponseBody = await response.json();

      if (response.status === 201) {
        setEditingStatus("success");
        setSuccessMessage("Cadastro completado com sucesso!");
        return;
      }
      setErrorMessage(
        `${editingResponseBody.message} ${editingResponseBody.action}`,
      );
      setEditingStatus("failure");
    } catch {
      setErrorMessage(
        "Não foi possível editar seu perfil. Tente novamente mais tarde.",
      );
      setEditingStatus("failure");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="normal">
        <FormControl required>
          <FormControl.Label>Nome</FormControl.Label>

          <TextInput
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            autoComplete="name"
            disabled={editingStatus === "loading"}
            block
          />
        </FormControl>

        <FormControl>
          <FormControl.Label>CPF</FormControl.Label>

          <TextInput type="text" value={formatCpf(cpf)} readOnly block />
          <FormControl.Caption>
            O CPF pertence à sua conta e não pode ser alterado neste formulário.
            Para informar um erro, clique aqui.
          </FormControl.Caption>
        </FormControl>

        <FormControl>
          <FormControl.Label>E-mail</FormControl.Label>

          <TextInput type="email" value={email} readOnly block />

          <FormControl.Caption>
            O e-mail pertence à sua conta de usuário. Para alterar, clique aqui.
          </FormControl.Caption>
        </FormControl>

        <FormControl>
          <FormControl.Label>Telefone</FormControl.Label>

          <TextInput type="text" value="(11) 99999-9999" block />
        </FormControl>

        <Stack.Item>
          <Button
            type="submit"
            variant="primary"
            disabled={editingStatus === "loading"}
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

import { useEffect, useState } from "react";
import { Button, Stack, Heading, Banner, Text } from "@primer/react";
import { Card } from "@primer/react/experimental";
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

        if (userResponse.status !== 200) {
          const errorBody = await userResponse.json();

          throw new Error(`${errorBody.message} ${errorBody.action}`);
        }

        const userData = await userResponse.json();

        setCurrentUser(userData);

        // 2. Busca a pessoa física associada ao usuário
        const personResponse = await fetch("/api/v1/person");

        if (personResponse.status === 200) {
          const personData = await personResponse.json();

          setNaturalPerson(personData);
          setLoadingStatus("success");
          return;
        }

        // O usuário existe, mas ainda não possui pessoa física cadastrada
        if (personResponse.status === 404) {
          setNaturalPerson(null);
          setLoadingStatus("success");
          return;
        }

        // 409, 500 ou outros erros
        const errorBody = await personResponse.json();

        throw new Error(`${errorBody.message} ${errorBody.action}`);
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
        {loadingStatus === "loading" && <Text>Carregando...</Text>}

        {loadingStatus === "success" && (
          <>
            <AccountSection user={currentUser} />

            <PersonalDataSection person={naturalPerson} />
          </>
        )}

        {loadingStatus === "failure" && (
          <Banner
            variant="critical"
            title="Erro"
            hideTitle
            description={errorMessage || "Não foi possível carregar o perfil."}
          />
        )}
      </Stack>
    </DefaultLayout>
  );
}

function AccountSection({ user }) {
  return (
    <Stack gap="normal">
      <Heading as="h2">Dados de acesso</Heading>
      <Stack.Item>
        <Card>
          <Card.Heading>Email</Card.Heading>

          <Card.Description>{user.email}</Card.Description>
          <Card.Metadata>
            <Button size="small">Alterar</Button>
          </Card.Metadata>
        </Card>
      </Stack.Item>
      <Stack.Item>
        <Card>
          <Card.Heading>Senha</Card.Heading>

          <Card.Description>••••••••</Card.Description>
          <Card.Metadata>
            <Button size="small">Alterar</Button>
          </Card.Metadata>
        </Card>
      </Stack.Item>
    </Stack>
  );
}

function PersonalDataSection({ person }) {
  if (!person) {
    return (
      <Stack gap="normal">
        <Heading as="h2">Dados pessoais</Heading>

        <Banner
          title="Cadastro incompleto"
          description="Seus dados pessoais ainda não foram cadastrados."
        />

        <Stack.Item>
          <Button variant="primary">Completar cadastro</Button>
        </Stack.Item>
      </Stack>
    );
  }

  return (
    <Stack gap="normal">
      <Heading as="h2">Dados pessoais</Heading>
      <Stack.Item>
        <Card>
          <Card.Heading>Nome</Card.Heading>
          <Card.Description>{person.name}</Card.Description>
          <Card.Metadata>
            <Button size="small">Alterar</Button>
          </Card.Metadata>
        </Card>
      </Stack.Item>
      <Stack.Item>
        <Card>
          <Card.Heading>Nome</Card.Heading>
          <Card.Description>{formatCpf(person.cpf)}</Card.Description>
        </Card>
      </Stack.Item>
    </Stack>
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

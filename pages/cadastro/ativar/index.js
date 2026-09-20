import { Banner } from "@primer/react";
import DefaultLayout from "interface/DefaultLayout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function ActivateUserPage() {
  const router = useRouter();
  const activationTokenId = router.query.activationTokenId;
  const [activationStatus, setActivationStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!activationTokenId) {
      return; //eartly return if activationTokenId is not available yet
    }

    sendActivationRequest();

    async function sendActivationRequest() {
      try {
        const response = await fetch(`/api/activate/${activationTokenId}`, {
          method: "PATCH",
        });

        const activationResponseBody = await response.json();

        if (response.status === 200) {
          setActivationStatus("success");
          return;
        }
        setErrorMessage(
          `${activationResponseBody.message} ${activationResponseBody.action}`,
        );
        setActivationStatus("failure");
      } catch {
        setErrorMessage(
          "Não foi possível ativar o seu cadastro. Tente novamente mais tarde.",
        );
        setActivationStatus("failure");
      }
    }
  }, [activationTokenId]);

  return (
    <DefaultLayout
      contentWidth="small"
      metadata={{
        title: "Ativar cadastro",
      }}
    >
      {activationStatus === "loading" && (
        <Banner variant="info">
          <Banner.Title>Verificando token...</Banner.Title>
        </Banner>
      )}

      {activationStatus === "success" && (
        <Banner variant="success">
          <Banner.Title>Cadastro ativado com sucesso!</Banner.Title>
          <Banner.Description>
            Sua conta está ativada e você já pode{" "}
            <a href="/login">fazer login</a>.
          </Banner.Description>
        </Banner>
      )}

      {activationStatus === "failure" && (
        <Banner variant="critical">
          <Banner.Title>Não foi possível ativar o seu cadastro</Banner.Title>
          <Banner.Description>{errorMessage}</Banner.Description>
        </Banner>
      )}
    </DefaultLayout>
  );
}

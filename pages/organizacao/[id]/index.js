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
import { useRouter } from "next/router";
import DefaultLayout from "../../../interface/DefaultLayout";

export default function OrganizationDetailsPage() {
  const router = useRouter();
  const organizationId = router.query.id;
  const [formValues, setFormValues] = useState({ name: "", cnpj: "" });
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!router.isReady || typeof organizationId !== "string") {
      return;
    }

    let isCurrentRequest = true;

    async function loadOrganization() {
      try {
        setLoadingStatus("loading");
        setErrorMessage(null);

        const response = await fetch(`/api/v1/persons/legal/${organizationId}`);
        const responseBody = await response.json();

        if (!response.ok) {
          throw new Error(
            `${responseBody.message} ${responseBody.action}`.trim(),
          );
        }

        if (isCurrentRequest) {
          setFormValues({
            name: responseBody.name,
            cnpj: responseBody.cnpj,
          });
          setLoadingStatus("success");
        }
      } catch (error) {
        if (isCurrentRequest) {
          setErrorMessage(
            error.message || "Não foi possível carregar a organização.",
          );
          setLoadingStatus("failure");
        }
      }
    }

    loadOrganization();

    return () => {
      isCurrentRequest = false;
    };
  }, [router.isReady, organizationId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/v1/persons/legal/${organizationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formValues),
      });
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `${responseBody.message} ${responseBody.action}`.trim(),
        );
      }

      await router.push("/organizacao");
    } catch (error) {
      setErrorMessage(
        error.message || "Não foi possível atualizar a organização.",
      );
      setSubmitStatus("failure");
    }
  }

  return (
    <DefaultLayout
      contentWidth="small"
      metadata={{
        title: "Editar organização",
        description: "Atualize os dados da organização",
      }}
    >
      <Stack gap="spacious">
        {loadingStatus === "loading" && <Text>Carregando organização...</Text>}

        {loadingStatus === "success" && (
          <Stack gap="normal">
            <Heading as="h1">Editar organização</Heading>
            <form onSubmit={handleSubmit}>
              <Stack gap="normal">
                <FormControl>
                  <FormControl.Label>Razão social</FormControl.Label>
                  <TextInput
                    value={formValues.name}
                    onChange={(event) =>
                      setFormValues((currentValues) => ({
                        ...currentValues,
                        name: event.target.value,
                      }))
                    }
                    required
                    maxLength={254}
                    block
                    disabled={submitStatus === "loading"}
                  />
                </FormControl>
                <FormControl>
                  <FormControl.Label>CNPJ</FormControl.Label>
                  <TextInput
                    value={formValues.cnpj}
                    onChange={(event) =>
                      setFormValues((currentValues) => ({
                        ...currentValues,
                        cnpj: event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 14),
                      }))
                    }
                    inputMode="numeric"
                    maxLength={14}
                    required
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
                    onClick={() => router.push("/organizacao")}
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

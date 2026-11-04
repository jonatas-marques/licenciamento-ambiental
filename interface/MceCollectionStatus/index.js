import { Banner, Text } from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import Link from "next/link";

// Mensagens de carregamento, erro e "projeto sem MCE" das telas do MCE.
// Não mostra nada quando os dados estão prontos.
export default function MceCollectionStatus({
  projectId,
  title,
  loadingStatus,
  errorMessage,
  hasMce,
}) {
  if (loadingStatus === "loading") {
    return <Text>Carregando...</Text>;
  }

  if (loadingStatus === "failure") {
    return (
      <Banner
        variant="critical"
        title="Não foi possível carregar"
        description={errorMessage}
      />
    );
  }

  if (!hasMce) {
    return (
      <Blankslate border>
        <Blankslate.Heading>
          Este projeto ainda não possui MCE
        </Blankslate.Heading>
        <Blankslate.Description>
          Crie o MCE para cadastrar {title.toLowerCase()}.
        </Blankslate.Description>
        <Blankslate.PrimaryAction as={Link} href={`/projetos/${projectId}/mce`}>
          Ir para o MCE
        </Blankslate.PrimaryAction>
      </Blankslate>
    );
  }

  return null;
}

import { Banner } from "@primer/react";
import DefaultLayout from "interface/DefaultLayout";

export default function ConfirmRegisterPage() {
  return (
    <DefaultLayout
      contentWidth="small"
      metadata={{
        title: "Confirme seu email",
      }}
    >
      <Banner
        variant="warning"
        title="Falta só uma etapa!"
        description="Um email de confirmação foi enviado para o endereço fornecido. Por favor, verifique sua caixa de entrada e siga as instruções para concluir o processo de registro."
      />
    </DefaultLayout>
  );
}

import ResourceManagement from "../../interface/ResourceManagement";
import DefaultLayout from "../../interface/DefaultLayout";

export default function OrganizationsPage() {
  return (
    <DefaultLayout
      metadata={{
        title: "Organizações",
        description: "Gerencie as organizações das quais você participa",
      }}
    >
      <ResourceManagement
        title="Organizações"
        description="Acompanhe e gerencie as pessoas jurídicas das quais você faz parte."
        resourceName="organização"
        pluralName="organizações"
        endpoint="/api/v1/persons/legal"
        article="a"
        firstOrdinal="primeira"
        emptyTitle="Nenhuma organização para exibir"
        emptyDescription="Crie sua primeira organização para gerenciar as pessoas jurídicas relacionadas aos projetos."
        fields={[
          { name: "name", label: "Razão Social" },
          {
            name: "cnpj",
            label: "CNPJ",
            placeholder: "00.000.000/0000-00",
          },
        ]}
      />
    </DefaultLayout>
  );
}

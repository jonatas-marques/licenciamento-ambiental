import ResourceManagement from "../../interface/ResourceManagement";
import DefaultLayout from "../../interface/DefaultLayout";

export default function ProjectsPage() {
  return (
    <DefaultLayout
      metadata={{
        title: "Projetos",
        description: "Gerencie os projetos dos quais você participa",
      }}
    >
      <ResourceManagement
        title="Projetos"
        description="Acompanhe e gerencie os projetos dos quais você faz parte."
        resourceName="projeto"
        pluralName="projetos"
        endpoint="/api/v1/projects"
        article="o"
        firstOrdinal="primeiro"
        emptyTitle="Nenhum projeto para exibir"
        emptyDescription="Crie seu primeiro projeto para começar a organizar as informações do licenciamento."
        fields={[{ name: "name", label: "Nome do projeto" }]}
      />
    </DefaultLayout>
  );
}

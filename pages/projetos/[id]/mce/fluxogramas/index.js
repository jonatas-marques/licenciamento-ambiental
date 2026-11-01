import MceCollectionPage from "../../../../../interface/MceCollectionPage";

const fields = [
  { name: "name", label: "Nome", required: true },
  { name: "activity", label: "Atividade" },
  { name: "description", label: "Descrição", multiline: true },
];

export default function ProjectFlowchartsPage() {
  return (
    <MceCollectionPage
      section="flowcharts"
      collection="flowcharts"
      title="Fluxogramas"
      description="Processos produtivos do empreendimento."
      singular="fluxograma"
      fields={fields}
    />
  );
}

import { Heading, Stack } from "@primer/react";
import DefaultLayout from "../../../../../interface/DefaultLayout";
import FlowchartEditor from "../../../../../interface/FlowchartEditor";
import MceCollectionStatus from "../../../../../interface/MceCollectionStatus";
import MceItemSection from "../../../../../interface/MceItemSection";
import createProjectNavigation from "../../../../../interface/ProjectNavigation";
import useMceCollection from "../../../../../interface/useMceCollection";

const title = "Fluxogramas";
const description = "Processos produtivos do empreendimento.";

const fields = [
  { name: "name", label: "Nome", required: true },
  { name: "activity", label: "Atividade" },
  { name: "description", label: "Descrição", multiline: true },
];

export default function ProjectFlowchartsPage() {
  const mce = useMceCollection("flowcharts");
  const isReady = mce.loadingStatus === "success" && mce.hasMce;

  return (
    <DefaultLayout
      subNavigation={createProjectNavigation(mce.projectId, "flowcharts")}
      metadata={{
        title: "Fluxogramas",
        description: "Editar fluxogramas do empreendimento ou atividade",
      }}
    >
      <Stack gap="spacious">
        {mce.projectName && <Heading as="h1">{mce.projectName}</Heading>}
        <MceCollectionStatus title={title} {...mce} />
        {isReady && (
          <>
            <MceItemSection
              projectId={mce.projectId}
              collection="flowcharts"
              title={title}
              description={description}
              singular="fluxograma"
              fields={fields}
              items={mce.items}
              onItemsChange={mce.setItems}
              canEdit={mce.canEdit}
            />
            <FlowchartEditor
              projectId={mce.projectId}
              flowcharts={mce.items}
              canEdit={mce.canEdit}
            />
          </>
        )}
      </Stack>
    </DefaultLayout>
  );
}

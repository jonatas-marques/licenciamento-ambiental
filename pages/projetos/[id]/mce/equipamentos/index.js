import EquipmentFormFields from "../../../../../interface/EquipmentFormFields";
import { Heading, Stack } from "@primer/react";
import DefaultLayout from "../../../../../interface/DefaultLayout";
import MceCollectionStatus from "../../../../../interface/MceCollectionStatus";
import MceItemSection from "../../../../../interface/MceItemSection";
import createProjectNavigation from "../../../../../interface/ProjectNavigation";
import useMceCollection from "../../../../../interface/useMceCollection";

const title = "Equipamentos";
const description = "Equipamentos utilizados pelo empreendimento.";

// Campos enviados à API; o formulário em si é o EquipmentFormFields.
const fields = [
  { name: "name_id" },
  { name: "model_id" },
  { name: "custom_name" },
  { name: "brand" },
  { name: "model" },
  { name: "description" },
  { name: "power" },
  { name: "capacity" },
  { name: "mobility" },
  { name: "location" },
  { name: "status" },
];

const columns = [
  { name: "name", label: "Nome" },
  { name: "category", label: "Categoria" },
  { name: "brand", label: "Marca" },
  { name: "model", label: "Modelo" },
  { name: "power", label: "Potência" },
  { name: "capacity", label: "Capacidade" },
  { name: "mobility", label: "Mobilidade" },
  { name: "location", label: "Local" },
  { name: "status", label: "Situação" },
];

export default function ProjectEquipmentsPage() {
  const mce = useMceCollection("equipments");
  const isReady = mce.loadingStatus === "success" && mce.hasMce;

  return (
    <DefaultLayout
      subNavigation={createProjectNavigation(mce.projectId, "equipments")}
      metadata={{
        title: "Equipamentos",
        description: "Editar equipamentos do empreendimento ou atividade",
      }}
    >
      <Stack gap="spacious">
        {mce.projectName && <Heading as="h1">{mce.projectName}</Heading>}
        <MceCollectionStatus title={title} {...mce} />
        {isReady && (
          <MceItemSection
            projectId={mce.projectId}
            collection="equipments"
            title={title}
            description={description}
            singular="equipamento"
            fields={fields}
            columns={columns}
            renderFormFields={(props) => <EquipmentFormFields {...props} />}
            items={mce.items}
            onItemsChange={mce.setItems}
            canEdit={mce.canEdit}
          />
        )}
      </Stack>
    </DefaultLayout>
  );
}

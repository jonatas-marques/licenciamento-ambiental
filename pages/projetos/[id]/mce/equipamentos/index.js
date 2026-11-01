import EquipmentFormFields from "../../../../../interface/EquipmentFormFields";
import MceCollectionPage from "../../../../../interface/MceCollectionPage";

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
  return (
    <MceCollectionPage
      section="equipments"
      collection="equipments"
      title="Equipamentos"
      description="Equipamentos utilizados pelo empreendimento."
      singular="equipamento"
      fields={fields}
      columns={columns}
      renderFormFields={(props) => <EquipmentFormFields {...props} />}
    />
  );
}

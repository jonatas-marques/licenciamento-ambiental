import { useEffect, useId, useState } from "react";
import { TextInput } from "@primer/react";

let unitsRequest = null;

// As unidades vêm da tabela `units` (SI) e são buscadas uma única vez.
function loadUnits() {
  unitsRequest ??= fetch("/api/v1/units")
    .then((response) => (response.ok ? response.json() : { units: [] }))
    .then((body) => body.units)
    .catch(() => {
      unitsRequest = null;
      return [];
    });
  return unitsRequest;
}

// Campo de texto que sugere as unidades do SI; aceita também expressões
// compostas (m³/h, kg/d), validadas pela API.
export default function UnitInput(props) {
  const listId = useId();
  const [units, setUnits] = useState([]);

  useEffect(() => {
    let isCurrent = true;
    loadUnits().then((loaded) => isCurrent && setUnits(loaded));
    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <>
      <TextInput {...props} list={listId} autoComplete="off" />
      <datalist id={listId}>
        <option value="m³/ano">Volume anual</option>
        {units.map((unit) => (
          <option key={unit.symbol} value={unit.symbol}>
            {unit.name} ({unit.quantity})
          </option>
        ))}
      </datalist>
    </>
  );
}

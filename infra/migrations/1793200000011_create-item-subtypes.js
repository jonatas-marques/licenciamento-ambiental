exports.up = (pgm) => {
  // Subtipos de item: a categoria do item define qual tabela de detalhes é usada.
  const subtype = (name, columns) =>
    pgm.createTable(name, {
      id: {
        type: "uuid",
        primaryKey: true,
        references: "items",
        onDelete: "cascade",
      },
      ...columns,
    });

  subtype("item_wastes", {
    hazard_class: { type: "text" },
    abnt_class: { type: "text" },
    ibama_code: { type: "text" },
    final_destination: { type: "text" },
    notes: { type: "text" },
  });

  subtype("item_effluents", {
    type: { type: "text" }, // industrial, sanitario
    treated: { type: "boolean" },
    final_destination: { type: "text" },
  });

  subtype("item_energy", {
    type: { type: "text" }, // eletrica, termica, vapor, glp
    unit: { type: "text" },
  });

  subtype("item_emissions", {
    emission_factor: { type: "numeric" },
    unit: { type: "text" },
  });
};

exports.down = false;

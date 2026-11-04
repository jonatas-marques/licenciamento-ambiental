exports.up = (pgm) => {
  // Etapas (operações) de um fluxograma.
  pgm.createTable("operations", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    flowchart_id: {
      type: "uuid",
      notNull: true,
      references: "flowcharts",
      onDelete: "cascade",
    },
    boundary: {
      type: "text",
      notNull: true,
      default: "internal",
      check: "boundary IN ('internal', 'external')",
    },
    name: {
      type: "varchar(254)",
      notNull: true,
    },
    type: {
      type: "text",
    },
    // Pode evoluir para subtipos: transformação, apoio, estoque, fonte, sumidouro.
    category: {
      type: "text",
    },
    description: {
      type: "text",
    },
    shape_x: {
      type: "numeric",
    },
    shape_y: {
      type: "numeric",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  pgm.createIndex("operations", "flowchart_id");
  // Permite que os fluxos referenciem (id, flowchart_id) e fiquem no mesmo fluxograma.
  pgm.createIndex("operations", ["id", "flowchart_id"], {
    name: "operations_id_flowchart_id_unique",
    unique: true,
  });
};

exports.down = false;

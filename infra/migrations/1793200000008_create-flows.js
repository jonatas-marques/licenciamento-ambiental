exports.up = (pgm) => {
  // Fluxos entre duas etapas do mesmo fluxograma.
  pgm.createTable("flows", {
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
    source_operation_id: {
      type: "uuid",
      notNull: true,
    },
    target_operation_id: {
      type: "uuid",
      notNull: true,
    },
    label: {
      type: "text",
    },
    type: {
      type: "text",
    },
    description: {
      type: "text",
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

  pgm.addConstraint("flows", "flows_source_operation_fkey", {
    foreignKeys: {
      columns: ["source_operation_id", "flowchart_id"],
      references: "operations(id, flowchart_id)",
      onDelete: "cascade",
    },
  });
  pgm.addConstraint("flows", "flows_target_operation_fkey", {
    foreignKeys: {
      columns: ["target_operation_id", "flowchart_id"],
      references: "operations(id, flowchart_id)",
      onDelete: "cascade",
    },
  });

  pgm.createIndex("flows", "flowchart_id");
  pgm.createIndex("flows", "source_operation_id");
  pgm.createIndex("flows", "target_operation_id");
};

exports.down = false;

exports.up = (pgm) => {
  pgm.createTable("operation_groups", {
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
    name: { type: "varchar(254)", notNull: true },
    water_use: {
      type: "text",
      check: "water_use IN ('sanitario', 'industrial', 'outro')",
    },
    shape_x: { type: "numeric", notNull: true, default: 140 },
    shape_y: { type: "numeric", notNull: true, default: 240 },
    width: {
      type: "numeric",
      notNull: true,
      default: 240,
      check: "width >= 100",
    },
    height: {
      type: "numeric",
      notNull: true,
      default: 180,
      check: "height >= 80",
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
  pgm.addConstraint(
    "operation_groups",
    "operation_groups_id_flowchart_unique",
    {
      unique: ["id", "flowchart_id"],
    },
  );
  pgm.addColumns("operations", {
    group_id: { type: "uuid" },
    water_type: {
      type: "text",
      check:
        "water_type IN ('rede_publica', 'subterranea', 'superficial', 'outra_fonte', 'rede_coletora', 'corpo_hidrico', 'tratamento_externo', 'outro_destino')",
    },
  });
  pgm.sql(`
    ALTER TABLE operations ADD CONSTRAINT operations_group_flowchart_fkey
      FOREIGN KEY (group_id, flowchart_id) REFERENCES operation_groups(id, flowchart_id)
      ON DELETE SET NULL (group_id);
    ALTER TABLE flows ALTER COLUMN source_operation_id DROP NOT NULL;
    ALTER TABLE flows ALTER COLUMN target_operation_id DROP NOT NULL;
  `);
  pgm.addColumns("flows", {
    source_group_id: { type: "uuid" },
    target_group_id: { type: "uuid" },
    source_boundary: { type: "boolean", notNull: true, default: false },
    target_boundary: { type: "boolean", notNull: true, default: false },
    water_use: {
      type: "text",
      check: "water_use IN ('sanitario', 'industrial', 'outro')",
    },
    water_reuse: { type: "boolean", notNull: true, default: false },
  });
  pgm.sql(`
    ALTER TABLE flows ADD CONSTRAINT flows_source_group_fkey
      FOREIGN KEY (source_group_id, flowchart_id) REFERENCES operation_groups(id, flowchart_id);
    ALTER TABLE flows ADD CONSTRAINT flows_target_group_fkey
      FOREIGN KEY (target_group_id, flowchart_id) REFERENCES operation_groups(id, flowchart_id);
    ALTER TABLE flows ADD CONSTRAINT flows_source_endpoint_check CHECK (
      num_nonnulls(source_operation_id, source_group_id) + source_boundary::int = 1
    );
    ALTER TABLE flows ADD CONSTRAINT flows_target_endpoint_check CHECK (
      num_nonnulls(target_operation_id, target_group_id) + target_boundary::int = 1
    );
    ALTER TABLE flows ADD CONSTRAINT flows_distinct_endpoints_check CHECK (
      NOT (source_boundary AND target_boundary)
      AND (source_operation_id IS NULL OR target_operation_id IS NULL OR source_operation_id <> target_operation_id)
      AND (source_group_id IS NULL OR target_group_id IS NULL OR source_group_id <> target_group_id)
    );
  `);
  pgm.createIndex("operations", "group_id");
  pgm.createIndex("operation_groups", "flowchart_id");
};

exports.down = false;

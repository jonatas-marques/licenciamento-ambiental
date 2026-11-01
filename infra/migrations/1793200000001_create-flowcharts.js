exports.up = (pgm) => {
  // Fluxograma do processo produtivo (diagrama) de um MCE.
  // Etapas e fluxos serão adicionados em migrations futuras.
  pgm.createTable("flowcharts", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    mce_id: {
      type: "uuid",
      notNull: true,
      references: "mces",
      onDelete: "cascade",
    },
    name: {
      type: "varchar(254)",
      notNull: true,
    },
    activity: {
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

  pgm.createIndex("flowcharts", "mce_id");
};

exports.down = false;

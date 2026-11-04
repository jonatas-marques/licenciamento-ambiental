exports.up = (pgm) => {
  // Itens que circulam pelos fluxos (insumos, produtos, resíduos etc.).
  pgm.createTable("items", {
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
    // insumo | produto | residuo | efluente | emissao | energia | agua
    category: {
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

  pgm.createIndex("items", "mce_id");
};

exports.down = false;

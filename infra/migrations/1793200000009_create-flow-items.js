exports.up = (pgm) => {
  // Itens transportados por um fluxo, com quantidade e unidade.
  pgm.createTable("flow_items", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    flow_id: {
      type: "uuid",
      notNull: true,
      references: "flows",
      onDelete: "cascade",
    },
    item_id: {
      type: "uuid",
      notNull: true,
      references: "items",
      onDelete: "cascade",
    },
    quantity: {
      type: "numeric",
    },
    unit: {
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

  pgm.createIndex("flow_items", "flow_id");
  pgm.createIndex("flow_items", "item_id");
};

exports.down = false;

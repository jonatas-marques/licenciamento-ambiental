exports.up = (pgm) => {
  // O nome vem do dicionário (name_id) ou, se não existir nele, de custom_name.
  pgm.createTable("equipments", {
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
    name_id: {
      type: "uuid",
      references: "equipments_names",
      onDelete: "restrict",
    },
    custom_name: {
      type: "varchar(254)",
    },
    // Modelo do catálogo usado como ponto de partida (os dados são copiados).
    model_id: {
      type: "uuid",
      references: "equipment_models",
      onDelete: "restrict",
    },
    brand: {
      type: "varchar(254)",
    },
    model: {
      type: "varchar(254)",
    },
    description: {
      type: "text",
    },
    power: {
      type: "numeric",
    },
    capacity: {
      type: "numeric",
    },
    mobility: {
      type: "varchar(32)",
    },
    location: {
      type: "text",
    },
    status: {
      type: "varchar(32)",
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

  pgm.addConstraint("equipments", "equipments_name_check", {
    check: "name_id IS NOT NULL OR custom_name IS NOT NULL",
  });

  pgm.createIndex("equipments", "mce_id");
  pgm.createIndex("equipments", "name_id");
};

exports.down = false;

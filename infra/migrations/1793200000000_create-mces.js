exports.up = (pgm) => {
  // MCE: Memorial de Caracterização do Empreendimento.
  // Por enquanto, um único MCE por projeto e sem controle de versão.
  pgm.createTable("mces", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    project_id: {
      type: "uuid",
      notNull: true,
      unique: true,
      references: "projects",
      onDelete: "cascade",
    },
    status: {
      type: "varchar(16)",
      notNull: true,
      default: "draft",
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

  pgm.addConstraint("mces", "mces_status_check", {
    check: "status IN ('draft', 'completed')",
  });
};

exports.down = false;

exports.up = (pgm) => {
  pgm.createTable("parties", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    project_id: {
      type: "uuid",
      notNull: true,
      references: "projects",
      onDelete: "cascade",
    },
    // CPF ou CNPJ, sem FK: integridade garantida na aplicação
    person_cp: {
      type: "varchar(14)",
      notNull: true,
    },
    interest: {
      type: "varchar(32)",
      notNull: true,
    },
  });

  pgm.createIndex("parties", "person_cp");
};

exports.down = false;

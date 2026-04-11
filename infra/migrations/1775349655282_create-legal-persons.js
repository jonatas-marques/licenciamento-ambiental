exports.up = (pgm) => {
  pgm.createTable("legal_persons", {
    id: {
      type: "uuid",
      primaryKey: true,
    },
    cnpj: {
      type: "varchar(14)",
      notNull: true,
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
};

exports.down = false;

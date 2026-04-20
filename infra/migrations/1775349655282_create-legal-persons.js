exports.up = (pgm) => {
  pgm.createTable("legal_persons", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    cnpj: {
      type: "varchar(14)",
      notNull: true,
    },
    name: {
      type: "varchar(254)",
      notNull: true,
      unique: true,
    },
    created_by: {
      type: "uuid",
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

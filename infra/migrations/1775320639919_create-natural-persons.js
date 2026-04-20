exports.up = (pgm) => {
  pgm.createTable("natural_persons", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    cpf: {
      type: "varchar(11)",
      notNull: true,
    },
    name: {
      type: "varchar(254)",
      notNull: true,
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

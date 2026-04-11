exports.up = (pgm) => {
  pgm.createTable("persons", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    // Pessoa física ou jurídica
    type: {
      type: "varchar(30)",
      notNull: true,
    },
    name: {
      type: "varchar(254)",
      notNull: true,
    },
    created_by: {
      type: "uuid",
      notNull: false,
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

exports.up = (pgm) => {
  pgm.createTable("natural_persons", {
    id: {
      type: "uuid",
      primaryKey: true,
    },
    cpf: {
      type: "varchar(11)",
      notNull: true,
    },
    birth_date: {
      type: "date",
      notNull: true,
    },
    mother_name: {
      type: "varchar(254)",
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

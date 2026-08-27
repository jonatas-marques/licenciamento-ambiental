exports.up = (pgm) => {
  // Projects means `empreendimentos` in Portuguese,
  // but we are using the English name for the table
  // to keep it consistent with the rest of the codebase.
  pgm.createTable("projects", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
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

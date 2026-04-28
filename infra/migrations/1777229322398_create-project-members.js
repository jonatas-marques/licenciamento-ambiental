exports.up = (pgm) => {
  pgm.createTable("project_members", {
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
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "cascade",
    },
    role: {
      type: "varchar(32)",
      notNull: true,
    },
    valid_from: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    valid_to: {
      type: "timestamptz",
      notNull: false,
    },
  });

  pgm.createIndex("project_members", "project_id");

  pgm.createIndex("project_members", "user_id");

  pgm.createConstraint("project_members", "valid_to_check", {
    check: "valid_to IS NULL OR valid_to >= valid_from",
  });
};

exports.down = false;

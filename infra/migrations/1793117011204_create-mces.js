exports.up = (pgm) => {
  pgm.createTable("mces", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    project_id: {
      type: "uuid",
      notNull: true,
      references: "projects",
      onDelete: "restrict",
    },
    version: {
      type: "integer",
      notNull: true,
    },
    status: {
      type: "varchar(16)",
      notNull: true,
      default: "draft",
    },
    created_by: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "restrict",
    },
    updated_by: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "restrict",
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

  pgm.addConstraint("mces", "mces_version_positive_check", {
    check: "version > 0",
  });

  pgm.addConstraint("mces", "mces_status_check", {
    check: "status IN ('draft', 'archived')",
  });

  pgm.addConstraint("mces", "mces_project_version_unique", {
    unique: ["project_id", "version"],
  });

  pgm.createIndex("mces", "project_id", {
    name: "mces_one_draft_per_project_unique",
    unique: true,
    where: "status = 'draft'",
  });
};

exports.down = false;

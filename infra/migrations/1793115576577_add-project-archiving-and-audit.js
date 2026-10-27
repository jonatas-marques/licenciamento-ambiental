exports.up = (pgm) => {
  pgm.addColumn("projects", {
    status: {
      type: "varchar(16)",
      notNull: true,
      default: "active",
    },
    updated_by: {
      type: "uuid",
      notNull: false,
    },
  });

  pgm.addConstraint("projects", "projects_status_check", {
    check: "status IN ('active', 'archived')",
  });

  pgm.sql(`
    ALTER TABLE projects
    ADD CONSTRAINT projects_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES users (id)
    ON DELETE RESTRICT
    NOT VALID;
  `);

  pgm.addConstraint("projects", "projects_updated_by_fkey", {
    foreignKeys: {
      columns: "updated_by",
      references: "users",
      onDelete: "SET NULL",
    },
  });
};

exports.down = false;

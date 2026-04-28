exports.up = (pgm) => {
  pgm.createTable("legal_person_members", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    legal_person_id: {
      type: "uuid",
      notNull: true,
      references: "legal_persons",
      onDelete: "cascade",
    },
    natural_person_id: {
      type: "uuid",
      notNull: true,
      references: "natural_persons",
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
  pgm.createConstraint("legal_person_members", "valid_to_check", {
    check: "valid_to IS NULL OR valid_to >= valid_from",
  });
};

exports.down = false;

exports.up = (pgm) => {
  pgm.createTable("person_relations", {
    id: {
      type: "uuid",
      primaryKey: true,
    },
    person_id: {
      type: "uuid",
      notNull: true,
    },
    related_person_id: {
      type: "uuid",
      notNull: true,
    },
    relation: {
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
      notNull: true,
      default: null,
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
  pgm.addConstraint(
    "person_relations",
    "person_relations_valid_period_check",
    "CHECK(valid_to IS NULL OR valid_to >= valid_from)",
  );
};

exports.down = false;

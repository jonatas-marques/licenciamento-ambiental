exports.up = (pgm) => {
  // Dicionário de categorias de equipamentos, gerido por usuários especiais.
  pgm.createTable("equipments_categories", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    category: {
      type: "varchar(254)",
      notNull: true,
    },
    active: {
      type: "boolean",
      notNull: true,
      default: true,
    },
  });

  pgm.createIndex("equipments_categories", "lower(category)", {
    name: "equipments_categories_category_unique",
    unique: true,
  });

  pgm.sql(`
    INSERT INTO equipments_categories (category) VALUES
      ('Geração de energia'),
      ('Geração de calor'),
      ('Ar comprimido'),
      ('Refrigeração'),
      ('Movimentação de cargas'),
      ('Usinagem'),
      ('Tratamento de efluentes');
  `);
};

exports.down = false;

exports.up = (pgm) => {
  // Dicionário de nomes de equipamentos, gerido por usuários especiais.
  pgm.createTable("equipments_names", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    name: {
      type: "varchar(254)",
      notNull: true,
    },
    category_id: {
      type: "uuid",
      notNull: true,
      references: "equipments_categories",
      onDelete: "restrict",
    },
    active: {
      type: "boolean",
      notNull: true,
      default: true,
    },
  });

  pgm.createIndex("equipments_names", ["category_id", "lower(name)"], {
    name: "equipments_names_category_name_unique",
    unique: true,
  });

  pgm.sql(`
    INSERT INTO equipments_names (name, category_id)
    SELECT seed.name, equipments_categories.id
    FROM (VALUES
      ('Gerador a diesel', 'Geração de energia'),
      ('Painel solar fotovoltaico', 'Geração de energia'),
      ('Caldeira', 'Geração de calor'),
      ('Forno', 'Geração de calor'),
      ('Compressor de ar', 'Ar comprimido'),
      ('Câmara fria', 'Refrigeração'),
      ('Chiller', 'Refrigeração'),
      ('Empilhadeira', 'Movimentação de cargas'),
      ('Ponte rolante', 'Movimentação de cargas'),
      ('Torno', 'Usinagem'),
      ('Serra', 'Usinagem'),
      ('Estação de tratamento de efluentes', 'Tratamento de efluentes')
    ) AS seed (name, category)
    JOIN equipments_categories ON equipments_categories.category = seed.category;
  `);
};

exports.down = false;

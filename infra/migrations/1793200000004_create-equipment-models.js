exports.up = (pgm) => {
  // Catálogo de equipamentos padrão (marca/modelo), gerido por usuários
  // especiais. Ao escolher um modelo, os dados são copiados para o equipamento
  // do MCE, que continua editável.
  pgm.createTable("equipment_models", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    name_id: {
      type: "uuid",
      notNull: true,
      references: "equipments_names",
      onDelete: "restrict",
    },
    brand: {
      type: "varchar(254)",
      notNull: true,
    },
    model: {
      type: "varchar(254)",
      notNull: true,
    },
    power: {
      type: "numeric",
    },
    capacity: {
      type: "numeric",
    },
    mobility: {
      type: "varchar(32)",
    },
    active: {
      type: "boolean",
      notNull: true,
      default: true,
    },
  });

  pgm.createIndex("equipment_models", ["lower(brand)", "lower(model)"], {
    name: "equipment_models_brand_model_unique",
    unique: true,
  });
  pgm.createIndex("equipment_models", "name_id");

  // Dados fictícios de exemplo; devem ser substituídos pelo catálogo real.
  pgm.sql(`
    INSERT INTO equipment_models (name_id, brand, model, power, capacity, mobility)
    SELECT equipments_names.id, seed.brand, seed.model, seed.power, seed.capacity, seed.mobility
    FROM (VALUES
      ('Compressor de ar', 'Mecalor', '250TR', 15, 250, 'fixo'),
      ('Compressor de ar', 'Tramontex', '3GR', 3.7, 50, 'móvel'),
      ('Gerador a diesel', 'Geradex', 'GD-100', 80, 100, 'fixo'),
      ('Gerador a diesel', 'Geradex', 'GD-20', 16, 20, 'móvel'),
      ('Caldeira', 'Termosul', 'CV-500', 350, 500, 'fixo'),
      ('Empilhadeira', 'Movimax', 'EL-25', 30, 2500, 'móvel'),
      ('Chiller', 'Frioplus', 'CH-60', 45, 60, 'fixo'),
      ('Torno', 'Usinar', 'T-1000', 5.5, NULL, 'fixo')
    ) AS seed (name, brand, model, power, capacity, mobility)
    JOIN equipments_names ON equipments_names.name = seed.name;
  `);
};

exports.down = false;

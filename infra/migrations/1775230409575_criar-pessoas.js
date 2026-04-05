exports.up = (pgm) => {
  pgm.createTable("pessoas", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    // Pessoa física ou jurídica
    tipo: {
      type: "varchar(30)",
      notNull: true,
    },
    nome: {
      type: "varchar(254)",
      notNull: true,
    },
    criado_por: {
      type: "uuid",
      notNull: false,
    },
    criado_em: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    atualizado_em: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });
};

exports.down = false;

exports.up = (pgm) => {
  pgm.createTable("pessoa_juridica", {
    id: {
      type: "uuid",
      primaryKey: true,
    },
    cnpj: {
      type: "varchar(14)",
      notNull: true,
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

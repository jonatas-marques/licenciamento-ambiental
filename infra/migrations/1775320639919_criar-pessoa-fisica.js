exports.up = (pgm) => {
  pgm.createTable("pessoa_fisica", {
    id: {
      type: "uuid",
      primaryKey: true,
    },
    cpf: {
      type: "varchar(11)",
      notNull: true,
    },
    data_nascimento: {
      type: "date",
      notNull: true,
    },
    nome_mae: {
      type: "varchar(254)",
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

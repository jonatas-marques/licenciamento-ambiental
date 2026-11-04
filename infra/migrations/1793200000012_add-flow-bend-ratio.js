exports.up = (pgm) => {
  // O fluxo é desenhado em ângulos retos; este valor (0 a 1) diz em que ponto
  // do caminho entre as etapas ele desvia. Nulo usa o meio (0.5).
  pgm.addColumns("flows", {
    bend_ratio: { type: "numeric" },
  });
  pgm.addConstraint("flows", "flows_bend_ratio_check", {
    check: "bend_ratio IS NULL OR (bend_ratio >= 0 AND bend_ratio <= 1)",
  });
};

exports.down = false;

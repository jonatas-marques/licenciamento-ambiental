exports.up = (pgm) => {
  // Retângulo (em unidades da grade do editor) que representa o empreendimento:
  // etapas dentro dele são internas e fora dele são externas.
  pgm.addColumns("flowcharts", {
    boundary_x: { type: "numeric", notNull: true, default: 300 },
    boundary_y: { type: "numeric", notNull: true, default: 40 },
    boundary_width: { type: "numeric", notNull: true, default: 700 },
    boundary_height: { type: "numeric", notNull: true, default: 500 },
  });
};

exports.down = false;

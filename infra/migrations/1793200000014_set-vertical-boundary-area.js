exports.up = (pgm) => {
  // O fluxograma passou a correr de cima para baixo: o retângulo padrão do
  // empreendimento fica mais estreito e alto, com espaço acima para as fontes.
  pgm.sql(`
    UPDATE flowcharts
    SET boundary_x = 100, boundary_y = 200, boundary_width = 400, boundary_height = 640
    WHERE boundary_x = 300 AND boundary_y = 40
      AND boundary_width = 700 AND boundary_height = 500;
  `);
  pgm.alterColumn("flowcharts", "boundary_x", { default: 100 });
  pgm.alterColumn("flowcharts", "boundary_y", { default: 200 });
  pgm.alterColumn("flowcharts", "boundary_width", { default: 400 });
  pgm.alterColumn("flowcharts", "boundary_height", { default: 640 });
};

exports.down = false;

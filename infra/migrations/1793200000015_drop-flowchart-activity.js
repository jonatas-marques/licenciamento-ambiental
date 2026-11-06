exports.up = (pgm) => {
  // Remove a atividade dos fluxogramas; os valores existentes serão descartados.
  pgm.dropColumn("flowcharts", "activity");
};

exports.down = false;

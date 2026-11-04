// Unidades do Sistema Internacional (SI), conforme a brochura do INMETRO
// "Sistema Internacional de Unidades (SI)": unidades de base, unidades
// derivadas com nome especial e unidades aceitas para uso com o SI.
const UNITS = [
  // [symbol, name, quantity, kind, definition, accepts_prefix]
  ["m", "metro", "comprimento", "base", null, true],
  ["kg", "quilograma", "massa", "base", null, false],
  ["s", "segundo", "tempo", "base", null, true],
  ["A", "ampere", "corrente elétrica", "base", null, true],
  ["K", "kelvin", "temperatura termodinâmica", "base", null, true],
  ["mol", "mol", "quantidade de matéria", "base", null, true],
  ["cd", "candela", "intensidade luminosa", "base", null, true],

  ["g", "grama", "massa", "derived", "10⁻³ kg", true],
  ["rad", "radiano", "ângulo plano", "derived", "m/m", true],
  ["sr", "esferorradiano", "ângulo sólido", "derived", "m²/m²", true],
  ["Hz", "hertz", "frequência", "derived", "s⁻¹", true],
  ["N", "newton", "força", "derived", "kg·m·s⁻²", true],
  ["Pa", "pascal", "pressão", "derived", "N/m²", true],
  ["J", "joule", "energia, trabalho, calor", "derived", "N·m", true],
  ["W", "watt", "potência", "derived", "J/s", true],
  ["C", "coulomb", "carga elétrica", "derived", "A·s", true],
  ["V", "volt", "diferença de potencial elétrico", "derived", "W/A", true],
  ["F", "farad", "capacitância", "derived", "C/V", true],
  ["Ω", "ohm", "resistência elétrica", "derived", "V/A", true],
  ["S", "siemens", "condutância elétrica", "derived", "A/V", true],
  ["Wb", "weber", "fluxo magnético", "derived", "V·s", true],
  ["T", "tesla", "densidade de fluxo magnético", "derived", "Wb/m²", true],
  ["H", "henry", "indutância", "derived", "Wb/A", true],
  ["°C", "grau Celsius", "temperatura Celsius", "derived", "K", false],
  ["lm", "lúmen", "fluxo luminoso", "derived", "cd·sr", true],
  ["lx", "lux", "iluminância", "derived", "lm/m²", true],
  ["Bq", "becquerel", "atividade de radionuclídeo", "derived", "s⁻¹", true],
  ["Gy", "gray", "dose absorvida", "derived", "J/kg", true],
  ["Sv", "sievert", "dose equivalente", "derived", "J/kg", true],
  ["kat", "katal", "atividade catalítica", "derived", "mol/s", true],

  ["min", "minuto", "tempo", "accepted", "60 s", false],
  ["h", "hora", "tempo", "accepted", "3 600 s", false],
  ["d", "dia", "tempo", "accepted", "86 400 s", false],
  [
    "au",
    "unidade astronômica",
    "comprimento",
    "accepted",
    "149 597 870 700 m",
    false,
  ],
  ["°", "grau", "ângulo plano", "accepted", "(π/180) rad", false],
  ["′", "minuto de arco", "ângulo plano", "accepted", "(π/10 800) rad", false],
  [
    "″",
    "segundo de arco",
    "ângulo plano",
    "accepted",
    "(π/648 000) rad",
    false,
  ],
  ["ha", "hectare", "área", "accepted", "10⁴ m²", false],
  ["L", "litro", "volume", "accepted", "10⁻³ m³", true],
  ["t", "tonelada", "massa", "accepted", "10³ kg", true],
  ["Da", "dalton", "massa", "accepted", "≈ 1,660 539 × 10⁻²⁷ kg", true],
  ["eV", "elétron-volt", "energia", "accepted", "≈ 1,602 177 × 10⁻¹⁹ J", true],
  ["Np", "neper", "razão logarítmica", "accepted", null, false],
  ["B", "bel", "razão logarítmica", "accepted", null, true],
  ["dB", "decibel", "razão logarítmica", "accepted", "10⁻¹ B", false],
];

const PREFIXES = [
  // [symbol, name, power of ten]
  ["Q", "quetta", 30],
  ["R", "ronna", 27],
  ["Y", "yotta", 24],
  ["Z", "zetta", 21],
  ["E", "exa", 18],
  ["P", "peta", 15],
  ["T", "tera", 12],
  ["G", "giga", 9],
  ["M", "mega", 6],
  ["k", "quilo", 3],
  ["h", "hecto", 2],
  ["da", "deca", 1],
  ["d", "deci", -1],
  ["c", "centi", -2],
  ["m", "mili", -3],
  ["µ", "micro", -6],
  ["n", "nano", -9],
  ["p", "pico", -12],
  ["f", "femto", -15],
  ["a", "atto", -18],
  ["z", "zepto", -21],
  ["y", "yocto", -24],
  ["r", "ronto", -27],
  ["q", "quecto", -30],
];

const quote = (value) =>
  value === null ? "NULL" : `'${String(value).replace(/'/g, "''")}'`;

exports.up = (pgm) => {
  pgm.createTable("units", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    symbol: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    quantity: { type: "text", notNull: true },
    kind: {
      type: "text",
      notNull: true,
      check: "kind IN ('base', 'derived', 'accepted')",
    },
    definition: { type: "text" },
    accepts_prefix: { type: "boolean", notNull: true, default: false },
    sort_order: { type: "integer", notNull: true },
  });

  pgm.createTable("unit_prefixes", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    symbol: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    power_of_ten: { type: "integer", notNull: true },
  });

  const unitRows = UNITS.map(
    ([symbol, name, quantity, kind, definition, prefix], index) =>
      `(${quote(symbol)}, ${quote(name)}, ${quote(quantity)}, ${quote(kind)}, ${quote(definition)}, ${prefix}, ${index})`,
  );
  pgm.sql(`
    INSERT INTO units (symbol, name, quantity, kind, definition, accepts_prefix, sort_order)
    VALUES ${unitRows.join(",\n")};
  `);

  const prefixRows = PREFIXES.map(
    ([symbol, name, power]) => `(${quote(symbol)}, ${quote(name)}, ${power})`,
  );
  pgm.sql(`
    INSERT INTO unit_prefixes (symbol, name, power_of_ten)
    VALUES ${prefixRows.join(",\n")};
  `);
};

exports.down = false;

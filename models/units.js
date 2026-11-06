import database from "infra/database.js";
import { ValidationError } from "infra/errors.js";

const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁻";
const EXPONENT = new RegExp(`(\\^?-?\\d+|[${SUPERSCRIPTS}]+)$`);
const SEPARATORS = /[·.*\s()]+/;

async function list() {
  const [units, prefixes] = await Promise.all([
    database.query(
      "SELECT symbol, name, quantity, kind, definition, accepts_prefix FROM units ORDER BY sort_order;",
    ),
    database.query(
      "SELECT symbol, name, power_of_ten FROM unit_prefixes ORDER BY power_of_ten DESC;",
    ),
  ]);
  return { units: units.rows, prefixes: prefixes.rows };
}

// Aceita expressões como "m³/h", "kg/m²·d", "kW·h" ou "kWh": símbolos do SI,
// com prefixo decimal quando permitido, expoentes e os operadores / e ·.
function isValidExpression(expression, { units, prefixes }) {
  const bySymbol = new Map(units.map((unit) => [unit.symbol, unit]));
  const prefixSymbols = new Set(prefixes.map((prefix) => prefix.symbol));

  function isUnitSymbol(raw) {
    const symbol = raw.replace("μ", "µ").replace(/^l$/, "L");
    if (bySymbol.has(symbol)) {
      return true;
    }
    const withMicro = symbol.replace(/^u/, "µ");
    for (const candidate of new Set([symbol, withMicro])) {
      for (let length = 1; length <= 2; length++) {
        const prefix = candidate.slice(0, length);
        const rest = candidate.slice(length).replace(/^l$/, "L");
        if (prefixSymbols.has(prefix) && bySymbol.get(rest)?.accepts_prefix) {
          return true;
        }
      }
    }
    return false;
  }

  function isSegment(segment) {
    return isUnitSymbol(segment.replace(EXPONENT, ""));
  }

  // "kWh" = "kW" + "h": tenta todas as divisões possíveis do trecho.
  function isToken(token) {
    if (token === "") {
      return false;
    }
    if (isSegment(token)) {
      return true;
    }
    for (let index = 1; index < token.length; index++) {
      if (isSegment(token.slice(0, index)) && isToken(token.slice(index))) {
        return true;
      }
    }
    return false;
  }

  return expression.split("/").every((part) => {
    const tokens = part.split(SEPARATORS).filter(Boolean);
    return tokens.length > 0 && tokens.every(isToken);
  });
}

async function assertValid(field, value) {
  if (value === null || value === undefined) {
    return;
  }
  // Volume anual é uma referência de período, não uma unidade SI de tempo.
  if (value === "m³/ano" || value === "m3/ano") {
    return;
  }
  if (!isValidExpression(value, await list())) {
    throw new ValidationError({
      name: "ValidationError",
      message: `A unidade '${value}' não é uma unidade do SI.`,
      action: `Use símbolos do SI em '${field}' (ex.: kg, m³/h, t/d, kW·h) ou m³/ano para volume anual. Consulte GET /api/v1/units.`,
      status_code: 400,
    });
  }
}

export default Object.freeze({ list, assertValid, isValidExpression });

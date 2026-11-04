// Funções puras de geometria e regras do editor de fluxogramas.
// Não acessam banco nem rede, para poderem ser usadas na interface.

export const GRID_SIZE = 10;
export const OPERATION_WIDTH = 160;
export const OPERATION_HEIGHT = 60;
export const CANVAS_MIN_WIDTH = 1400;
export const CANVAS_MIN_HEIGHT = 800;

export const OPERATION_BOUNDARIES = [
  { value: "internal", label: "Interna" },
  { value: "external", label: "Externa" },
];

// Fonte é o início do fluxograma (entrada de recursos) e sumidouro é o fim
// (destino de resíduos e produtos); ambos ficam fora do empreendimento.
export const OPERATION_CATEGORIES = [
  { value: "transformacao", label: "Transformação", boundary: "internal" },
  { value: "apoio", label: "Apoio", boundary: "internal" },
  { value: "estoque", label: "Estoque", boundary: "internal" },
  { value: "fonte", label: "Fonte (início)", boundary: "external" },
  { value: "sumidouro", label: "Sumidouro (fim)", boundary: "external" },
];

export const ITEM_CATEGORIES = [
  { value: "insumo", label: "Insumo" },
  { value: "produto", label: "Produto" },
  { value: "residuo", label: "Resíduo" },
  { value: "efluente", label: "Efluente" },
  { value: "emissao", label: "Emissão" },
  { value: "energia", label: "Energia" },
  { value: "agua", label: "Água" },
];

// Campos específicos de cada subtipo de item.
export const ITEM_DETAIL_FIELDS = {
  residuo: [
    { name: "hazard_class", label: "Classe de periculosidade" },
    { name: "abnt_class", label: "Classe ABNT" },
    { name: "ibama_code", label: "Código IBAMA" },
    { name: "final_destination", label: "Destinação final" },
    { name: "notes", label: "Observação", multiline: true },
  ],
  efluente: [
    { name: "type", label: "Tipo (industrial, sanitário...)" },
    { name: "treated", label: "Recebe tratamento", boolean: true },
    { name: "final_destination", label: "Destino final" },
  ],
  energia: [
    { name: "type", label: "Tipo (elétrica, térmica, vapor, GLP...)" },
    { name: "unit", label: "Unidade do SI (kW·h, J, m³...)" },
  ],
  emissao: [
    { name: "emission_factor", label: "Fator de emissão", number: true },
    { name: "unit", label: "Unidade do SI (ex.: kg/L)" },
  ],
};

// Categorias de item mais prováveis conforme o sentido do fluxo em relação
// à fronteira do empreendimento.
const SUGGESTED_ITEM_CATEGORIES = {
  input: ["insumo", "agua", "energia"],
  output: ["residuo", "efluente", "emissao", "produto"],
  internal: [],
};

export const DEFAULT_BOUNDARY_AREA = {
  x: 100,
  y: 200,
  width: 400,
  height: 640,
};
const MIN_BOUNDARY_WIDTH = 240;
const MIN_BOUNDARY_HEIGHT = 160;

const SIDES = ["top", "right", "bottom", "left"];

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function snap(value, enabled = true) {
  const clamped = Math.max(0, value);
  return enabled ? Math.round(clamped / GRID_SIZE) * GRID_SIZE : clamped;
}

function boxOf(operation, position = null) {
  return {
    x: position?.x ?? toNumber(operation.shape_x) ?? 0,
    y: position?.y ?? toNumber(operation.shape_y) ?? 0,
    width: OPERATION_WIDTH,
    height: OPERATION_HEIGHT,
  };
}

function intersects(a, b, margin = GRID_SIZE) {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin &&
    a.y + a.height + margin > b.y
  );
}

function boundaryAreaOf(source) {
  return {
    x: toNumber(source?.boundary_x) ?? DEFAULT_BOUNDARY_AREA.x,
    y: toNumber(source?.boundary_y) ?? DEFAULT_BOUNDARY_AREA.y,
    width: toNumber(source?.boundary_width) ?? DEFAULT_BOUNDARY_AREA.width,
    height: toNumber(source?.boundary_height) ?? DEFAULT_BOUNDARY_AREA.height,
  };
}

function resizeBoundaryArea(area, width, height) {
  return {
    ...area,
    width: Math.max(MIN_BOUNDARY_WIDTH, width),
    height: Math.max(MIN_BOUNDARY_HEIGHT, height),
  };
}

// Interna se o centro da etapa estiver dentro do retângulo do empreendimento.
function boundaryOf(box, area) {
  const point = center(box);
  const inside =
    point.x >= area.x &&
    point.x <= area.x + area.width &&
    point.y >= area.y &&
    point.y <= area.y + area.height;
  return inside ? "internal" : "external";
}

// Mantém a categoria se ela combina com a fronteira; senão usa uma padrão.
function categoryFor(boundary, category, box, area) {
  const allowed = OPERATION_CATEGORIES.filter(
    (entry) => entry.boundary === boundary,
  );
  if (allowed.some((entry) => entry.value === category)) {
    return category;
  }
  if (boundary === "internal") {
    return "transformacao";
  }
  // O fluxo corre de cima para baixo: fontes ficam acima do retângulo.
  return center(box).y < area.y ? "fonte" : "sumidouro";
}

// Região onde novas etapas de cada tipo são colocadas.
function regionFor(kind, area) {
  if (kind === "fonte") {
    return {
      x: area.x,
      y: Math.max(GRID_SIZE, area.y - OPERATION_HEIGHT - 60),
      width: area.width,
      height: OPERATION_HEIGHT,
    };
  }
  if (kind === "sumidouro") {
    return {
      x: area.x + area.width + 40,
      y: area.y + 30,
      width: OPERATION_WIDTH,
      height: area.height - 30,
    };
  }
  return {
    x: area.x + 2 * GRID_SIZE,
    y: area.y + 40,
    width: area.width - 4 * GRID_SIZE,
    height: area.height - 50,
  };
}

// Primeira posição livre da região, preenchendo de cima para baixo.
function findFreePosition(operations, region) {
  const boxes = operations
    .filter((operation) => toNumber(operation.shape_x) !== null)
    .map((operation) => boxOf(operation));
  const stepX = OPERATION_WIDTH + 4 * GRID_SIZE;
  const stepY = OPERATION_HEIGHT + 4 * GRID_SIZE;
  const columns = Math.max(
    1,
    Math.floor((region.width + 4 * GRID_SIZE) / stepX),
  );
  const rows = Math.max(1, Math.floor((region.height + 4 * GRID_SIZE) / stepY));
  const isFree = (x, y) =>
    !boxes.some((box) =>
      intersects(
        { x, y, width: OPERATION_WIDTH, height: OPERATION_HEIGHT },
        box,
      ),
    );

  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const x = region.x + column * stepX;
      const y = region.y + row * stepY;
      if (isFree(x, y)) {
        return { x, y };
      }
    }
  }
  // Região cheia: continua descendo na primeira coluna.
  for (let row = rows; row < 50; row++) {
    const y = region.y + row * stepY;
    if (isFree(region.x, y)) {
      return { x: region.x, y };
    }
  }
  return { x: region.x, y: region.y };
}

function anchorPoint(box, side) {
  const { x, y, width, height } = box;
  return {
    top: { x: x + width / 2, y },
    right: { x: x + width, y: y + height / 2 },
    bottom: { x: x + width / 2, y: y + height },
    left: { x, y: y + height / 2 },
  }[side];
}

function anchorPoints(box) {
  return SIDES.map((side) => ({ side, ...anchorPoint(box, side) }));
}

function center(box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Ponto onde a reta do centro da caixa até `target` cruza a borda da caixa.
function borderPoint(box, target) {
  const from = center(box);
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  if (dx === 0 && dy === 0) {
    return from;
  }
  const scale = Math.min(
    dx === 0 ? Infinity : box.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : box.height / 2 / Math.abs(dy),
  );
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Faixa em que duas etapas se sobrepõem num eixo, ou null se estiverem separadas.
function overlap(startA, sizeA, startB, sizeB) {
  const start = Math.max(startA, startB);
  const end = Math.min(startA + sizeA, startB + sizeB);
  return end > start ? { start, end } : null;
}

// Posição (no eixo transversal) em que o fluxo sai/entra: perto do centro da
// etapa, deslocada por `offset` e sempre dentro da etapa.
function lanePosition(start, size, offset) {
  const margin = Math.min(10, size / 2);
  return clamp(
    start + size / 2 + offset,
    start + margin,
    start + size - margin,
  );
}

// Traçado ortogonal (só ângulos retos) entre duas etapas. Sai pelo lado que
// olha para o destino, anda até `ratio` do caminho, desvia e chega ao destino:
// de 0 a 2 curvas. `offset` afasta fluxos paralelos entre o mesmo par.
// `handle` é o segmento do meio, que pode ser arrastado para mudar `ratio`.
function flowGeometry(sourceBox, targetBox, offset = 0, ratio = 0.5) {
  const gapX =
    targetBox.x >= sourceBox.x + sourceBox.width
      ? targetBox.x - (sourceBox.x + sourceBox.width)
      : sourceBox.x >= targetBox.x + targetBox.width
        ? sourceBox.x - (targetBox.x + targetBox.width)
        : 0;
  const gapY =
    targetBox.y >= sourceBox.y + sourceBox.height
      ? targetBox.y - (sourceBox.y + sourceBox.height)
      : sourceBox.y >= targetBox.y + targetBox.height
        ? sourceBox.y - (targetBox.y + targetBox.height)
        : 0;

  if (gapX === 0 && gapY === 0) {
    // Etapas sobrepostas: não há caminho ortogonal, liga pelas bordas.
    const from = borderPoint(sourceBox, center(targetBox));
    const to = borderPoint(targetBox, center(sourceBox));
    return {
      from,
      to,
      points: [from, to],
      middle: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
      handle: null,
    };
  }

  // O fluxograma é vertical: só segue na horizontal quando não há vão vertical.
  const horizontal = gapX > 0 && gapY === 0;
  // Eixo principal (a) é onde o fluxo anda; o transversal (b) é onde desvia.
  const [a, b, size, crossSize] = horizontal
    ? ["x", "y", "width", "height"]
    : ["y", "x", "height", "width"];
  const forward = targetBox[a] > sourceBox[a];
  const start = forward ? sourceBox[a] + sourceBox[size] : sourceBox[a];
  const end = forward ? targetBox[a] : targetBox[a] + targetBox[size];

  const shared = overlap(
    sourceBox[b],
    sourceBox[crossSize],
    targetBox[b],
    targetBox[crossSize],
  );
  let crossStart;
  let crossEnd;
  if (shared) {
    // Lado a lado: uma reta, dentro da faixa comum.
    crossStart = crossEnd = clamp(
      (shared.start + shared.end) / 2 + offset,
      shared.start + Math.min(10, (shared.end - shared.start) / 2),
      shared.end - Math.min(10, (shared.end - shared.start) / 2),
    );
  } else {
    crossStart = lanePosition(sourceBox[b], sourceBox[crossSize], offset);
    crossEnd = lanePosition(targetBox[b], targetBox[crossSize], offset);
  }

  const turn = start + (end - start) * clamp(ratio, 0.05, 0.95);
  const point = (main, cross) =>
    horizontal ? { x: main, y: cross } : { x: cross, y: main };
  const points = [point(start, crossStart)];
  if (crossStart !== crossEnd) {
    points.push(point(turn, crossStart), point(turn, crossEnd));
  }
  points.push(point(end, crossEnd));

  const index = Math.floor((points.length - 1) / 2);
  const [first, second] = [points[index], points[index + 1]];
  const middle = {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
  return {
    from: points[0],
    to: points[points.length - 1],
    points,
    middle,
    // Só dá para mexer na posição do desvio quando ele existe.
    handle:
      crossStart !== crossEnd ? { ...middle, horizontal, start, end } : null,
  };
}

// Deslocamento de cada fluxo entre o mesmo par de etapas (em qualquer sentido).
function flowOffsets(flows) {
  const groups = new Map();
  for (const flow of flows) {
    const key = [flow.source_operation_id, flow.target_operation_id]
      .sort()
      .join(":");
    groups.set(key, [...(groups.get(key) ?? []), flow]);
  }

  const offsets = new Map();
  for (const group of groups.values()) {
    group.forEach((flow, index) => {
      const sign =
        flow.source_operation_id <= flow.target_operation_id ? 1 : -1;
      offsets.set(flow.id, (index - (group.length - 1) / 2) * 24 * sign);
    });
  }
  return offsets;
}

function findOperationAt(boxes, point, ignoreId = null) {
  for (const [id, box] of boxes) {
    if (
      id !== ignoreId &&
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    ) {
      return id;
    }
  }
  return null;
}

// Sentido do fluxo em relação à fronteira: entrada, saída ou interno/externo.
function flowDirection(sourceBoundary, targetBoundary) {
  if (sourceBoundary === "external" && targetBoundary === "internal") {
    return "input";
  }
  if (sourceBoundary === "internal" && targetBoundary === "external") {
    return "output";
  }
  return sourceBoundary === "internal" ? "internal" : "external";
}

function suggestedItemCategories(direction) {
  return SUGGESTED_ITEM_CATEGORIES[direction] ?? [];
}

function canvasSize(boxes, area = null) {
  const all = [...boxes.values()];
  if (area) {
    all.push(area);
  }
  return {
    width: Math.max(
      CANVAS_MIN_WIDTH,
      ...all.map((box) => box.x + box.width + 200),
    ),
    height: Math.max(
      CANVAS_MIN_HEIGHT,
      ...all.map((box) => box.y + box.height + 200),
    ),
  };
}

function describeFlowItem(flowItem, itemName) {
  return [itemName, flowItem.quantity, flowItem.unit]
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join(" ");
}

const flowchart = {
  GRID_SIZE,
  OPERATION_WIDTH,
  OPERATION_HEIGHT,
  OPERATION_BOUNDARIES,
  OPERATION_CATEGORIES,
  ITEM_CATEGORIES,
  ITEM_DETAIL_FIELDS,
  boundaryAreaOf,
  resizeBoundaryArea,
  boundaryOf,
  categoryFor,
  regionFor,
  flowDirection,
  suggestedItemCategories,
  toNumber,
  snap,
  boxOf,
  findFreePosition,
  anchorPoints,
  flowGeometry,
  flowOffsets,
  findOperationAt,
  canvasSize,
  describeFlowItem,
};

export default flowchart;

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Banner,
  Button,
  Heading,
  IconButton,
  Select,
  Text,
  TextInput,
  useConfirm,
} from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import {
  PlusIcon,
  QuestionIcon,
  SignInIcon,
  SignOutIcon,
  SquareFillIcon,
  TrashIcon,
} from "@primer/octicons-react";
import flowchart from "models/flowchart.js";
import FlowItemPopover from "./FlowItemPopover";
import Inspector from "./Inspector";
import styles from "./index.module.css";

const ARROW_OFFSETS = {
  top: { x: 0, y: -24, angle: -90, label: "acima" },
  right: { x: 24, y: 0, angle: 0, label: "à direita" },
  bottom: { x: 0, y: 24, angle: 90, label: "abaixo" },
  left: { x: -24, y: 0, angle: 180, label: "à esquerda" },
};

const SHORTCUTS = [
  ["Ctrl + roda do mouse", "Aproxima ou afasta (zoom)"],
  ["Roda do mouse", "Rola a área de desenho"],
  ["Espaço + arrastar", "Move a área de desenho (pan)"],
  ["Clique duplo na etapa", "Edita o nome direto na etapa"],
  ["Arrastar uma etapa", "Move a etapa; dentro do retângulo é interna"],
  ["Arrastar um ponto azul", "Conecta a etapa a outra, criando um fluxo"],
  ["Clicar na seta azul", "Cria a próxima etapa já ligada por um fluxo"],
  ["Selecionar um fluxo", "Arraste a bolinha do meio para mover o desvio"],
  ["Duplo clique em um fluxo", "Cria ou escolhe um item que circula nele"],
  ["Delete ou Backspace", "Remove a etapa ou o fluxo selecionado"],
];

const EMPTY_DATA = { operations: [], flows: [], items: [], flowItems: [] };
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const PALETTE = [
  {
    kind: "transformacao",
    label: "Etapa interna",
    icon: SquareFillIcon,
    name: "Nova etapa",
  },
  { kind: "fonte", label: "Fonte (início)", icon: SignInIcon, name: "Fonte" },
  {
    kind: "sumidouro",
    label: "Sumidouro (fim)",
    icon: SignOutIcon,
    name: "Sumidouro",
  },
];
const CATEGORY_LABELS = Object.fromEntries(
  flowchart.OPERATION_CATEGORIES.map((entry) => [entry.value, entry.label]),
);

// Etapas sem posição salva ganham uma posição livre só para exibição.
function withPositions(operations, area) {
  const placed = operations.filter(
    (operation) => flowchart.toNumber(operation.shape_x) !== null,
  );
  const positioned = new Map();
  for (const operation of operations) {
    if (flowchart.toNumber(operation.shape_x) === null) {
      const position = flowchart.findFreePosition(
        placed,
        flowchart.regionFor("transformacao", area),
      );
      const entry = { ...operation, shape_x: position.x, shape_y: position.y };
      placed.push(entry);
      positioned.set(operation.id, entry);
    }
  }
  return operations.map(
    (operation) => positioned.get(operation.id) ?? operation,
  );
}

// Editor visual de fluxogramas: paleta, área de desenho em grade e propriedades.
export default function FlowchartEditor({ projectId, flowcharts, canEdit }) {
  const baseUrl = `/api/v1/projects/${projectId}/mce`;
  const confirm = useConfirm();
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const zoomRef = useRef(1);
  const pendingScrollRef = useRef(null);
  const panRef = useRef(null);
  const helpRef = useRef(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [itemPopover, setItemPopover] = useState(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [flowchartId, setFlowchartId] = useState("");
  const [data, setData] = useState(EMPTY_DATA);
  const [areas, setAreas] = useState({});
  const [selection, setSelection] = useState(null);
  const [drag, setDrag] = useState(null);
  const [connection, setConnection] = useState(null);
  const [resize, setResize] = useState(null);
  const [bend, setBend] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [newItem, setNewItem] = useState({ name: "", category: "" });
  const [errorMessage, setErrorMessage] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const selectedFlowchart =
    flowcharts.find((item) => item.id === flowchartId) ?? flowcharts[0];
  const selectedFlowchartId = selectedFlowchart?.id ?? "";

  const call = useCallback(
    async (path, options) => {
      const response = await fetch(`${baseUrl}/${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(`${body.message} ${body.action}`.trim());
      }
      return body;
    },
    [baseUrl],
  );

  const fetchAll = useCallback(async () => {
    const [operations, flows, items, flowItems] = await Promise.all([
      call("operations"),
      call("flows"),
      call("items"),
      call("flow_items"),
    ]);
    return { operations, flows, items, flowItems };
  }, [call]);

  useEffect(() => {
    let isCurrentRequest = true;
    fetchAll()
      .then((loaded) => isCurrentRequest && setData(loaded))
      .catch((error) => isCurrentRequest && setErrorMessage(error.message));
    return () => {
      isCurrentRequest = false;
    };
  }, [fetchAll]);

  // Zoom pela roda do mouse, mantendo o ponto sob o cursor fixo. Precisa de
  // listener nativo não passivo para impedir a rolagem da área.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    function handleWheel(event) {
      // Sem Ctrl (ou Cmd), a roda continua rolando a área normalmente.
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const current = zoomRef.current;
      const next = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, current * Math.exp(-event.deltaY * 0.0015)),
      );
      if (next === current) {
        return;
      }
      const ratio = next / current;
      pendingScrollRef.current = {
        left: (canvas.scrollLeft + offsetX) * ratio - offsetX,
        top: (canvas.scrollTop + offsetY) * ratio - offsetY,
      };
      zoomRef.current = next;
      setZoom(next);
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [selectedFlowchartId]);

  useLayoutEffect(() => {
    zoomRef.current = zoom;
    const pending = pendingScrollRef.current;
    if (pending && canvasRef.current) {
      canvasRef.current.scrollLeft = pending.left;
      canvasRef.current.scrollTop = pending.top;
      pendingScrollRef.current = null;
    }
  }, [zoom]);

  useEffect(() => {
    if (!helpOpen) {
      return;
    }
    function close(event) {
      if (
        event.type === "keydown"
          ? event.key === "Escape"
          : !helpRef.current?.contains(event.target)
      ) {
        setHelpOpen(false);
      }
    }
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [helpOpen]);

  async function run(action) {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const result = await action();
      setData(await fetchAll());
      return result ?? true;
    } catch (error) {
      setErrorMessage(error.message || "Não foi possível concluir a ação.");
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  const savedArea =
    areas[selectedFlowchartId] ?? flowchart.boundaryAreaOf(selectedFlowchart);
  const area = resize
    ? flowchart.resizeBoundaryArea(savedArea, resize.width, resize.height)
    : savedArea;

  const positioned = withPositions(
    data.operations.filter((item) => item.flowchart_id === selectedFlowchartId),
    area,
  );
  const boxes = new Map(
    positioned.map((operation) => [
      operation.id,
      flowchart.boxOf(
        operation,
        drag?.id === operation.id ? { x: drag.x, y: drag.y } : null,
      ),
    ]),
  );
  // A fronteira é sempre derivada da posição da etapa em relação ao retângulo.
  const operations = positioned.map((operation) => {
    const box = boxes.get(operation.id);
    const boundary = flowchart.boundaryOf(box, area);
    return {
      ...operation,
      boundary,
      category: flowchart.categoryFor(boundary, operation.category, box, area),
    };
  });
  const operationsById = new Map(
    operations.map((operation) => [operation.id, operation]),
  );
  const flows = data.flows.filter(
    (item) => item.flowchart_id === selectedFlowchartId,
  );
  const flowIds = new Set(flows.map((flow) => flow.id));
  const flowItems = data.flowItems.filter((item) => flowIds.has(item.flow_id));
  const offsets = flowchart.flowOffsets(flows);
  const size = flowchart.canvasSize(boxes, area);
  const itemName = (id) => data.items.find((item) => item.id === id)?.name;

  const activeSelection = (() => {
    if (!selection) {
      return null;
    }
    const exists = {
      operation: () => operationsById.has(selection.id),
      flow: () => flows.some((flow) => flow.id === selection.id),
      item: () => data.items.some((item) => item.id === selection.id),
    }[selection.kind];
    return exists() ? selection : null;
  })();

  function toPoint(event) {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / zoom,
      y: (event.clientY - rect.top) / zoom,
    };
  }

  function placementFor(operation, box) {
    const boundary = flowchart.boundaryOf(box, area);
    return {
      shape_x: box.x,
      shape_y: box.y,
      boundary,
      category: flowchart.categoryFor(boundary, operation.category, box, area),
    };
  }

  function addOperation(entry, point = null) {
    const region = flowchart.regionFor(
      entry.kind === "transformacao" ? "internal" : entry.kind,
      area,
    );
    const position = point
      ? {
          x: flowchart.snap(
            point.x - flowchart.OPERATION_WIDTH / 2,
            snapToGrid,
          ),
          y: flowchart.snap(
            point.y - flowchart.OPERATION_HEIGHT / 2,
            snapToGrid,
          ),
        }
      : flowchart.findFreePosition(operations, region);
    const placement = placementFor(
      { category: entry.kind },
      flowchart.boxOf({}, position),
    );
    const name =
      placement.category === entry.kind
        ? entry.name
        : (CATEGORY_LABELS[placement.category] ?? entry.name);

    return run(async () => {
      const created = await call("operations", {
        method: "POST",
        body: JSON.stringify({
          flowchart_id: selectedFlowchartId,
          name,
          ...placement,
        }),
      });
      setSelection({ kind: "operation", id: created.id });
    });
  }

  function startDrag(event, operation) {
    event.stopPropagation();
    setSelection({ kind: "operation", id: operation.id });
    if (!canEdit || isBusy) {
      return;
    }
    const point = toPoint(event);
    const box = boxes.get(operation.id);
    svgRef.current.setPointerCapture(event.pointerId);
    setDrag({
      id: operation.id,
      dx: point.x - box.x,
      dy: point.y - box.y,
      x: box.x,
      y: box.y,
      moved: false,
    });
  }

  // O clique é capturado pelo svg durante o arrasto, então o duplo clique é
  // resolvido por posição.
  function handleDoubleClick(event) {
    if (!canEdit || isBusy || spaceHeld) {
      return;
    }
    const id = flowchart.findOperationAt(boxes, toPoint(event));
    const operation = operations.find((entry) => entry.id === id);
    if (operation) {
      setSelection({ kind: "operation", id });
      setEditing({ id, value: operation.name });
    }
  }

  async function addItemToFlow(flowId, entry) {
    const done = await run(async () => {
      const createdItem = entry.existingId
        ? null
        : await call("items", {
            method: "POST",
            body: JSON.stringify({
              name: entry.name,
              category: entry.category,
            }),
          });
      try {
        await call("flow_items", {
          method: "POST",
          body: JSON.stringify({
            flow_id: flowId,
            item_id: entry.existingId ?? createdItem.id,
            quantity: entry.quantity,
            unit: entry.unit,
          }),
        });
      } catch (error) {
        // Não deixa um item órfão se o vínculo for recusado (ex.: unidade).
        if (createdItem) {
          await call(`items/${createdItem.id}`, { method: "DELETE" });
        }
        throw error;
      }
    });
    if (done) {
      setItemPopover(null);
    }
  }

  async function commitEditing(save) {
    const current = editing;
    setEditing(null);
    const name = current?.value.trim();
    const operation = operations.find((entry) => entry.id === current?.id);
    if (!save || !operation || !name || name === operation.name) {
      return;
    }
    await run(() =>
      call(`operations/${operation.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    );
  }

  // Cria uma etapa ao lado da selecionada, já ligada a ela por um fluxo.
  async function addNextOperation(source, side) {
    const sourceBox = boxes.get(source.id);
    const gap = 4 * flowchart.GRID_SIZE;
    const { OPERATION_WIDTH: width, OPERATION_HEIGHT: height } = flowchart;
    const horizontal = side === "left" || side === "right";
    const origin = {
      right: { x: sourceBox.x + sourceBox.width + gap, y: sourceBox.y },
      left: { x: sourceBox.x - width - gap, y: sourceBox.y },
      bottom: { x: sourceBox.x, y: sourceBox.y + sourceBox.height + gap },
      top: { x: sourceBox.x, y: sourceBox.y - height - gap },
    }[side];
    const overlaps = (position) =>
      [...boxes.values()].some(
        (other) =>
          position.x < other.x + other.width &&
          position.x + width > other.x &&
          position.y < other.y + other.height &&
          position.y + height > other.y,
      );
    // Se o lugar estiver ocupado, desliza perpendicularmente até achar vaga.
    let position = origin;
    for (let step = 1; overlaps(position) && step < 50; step++) {
      const offset = step * (horizontal ? height : width + gap) * 1.25;
      position = horizontal
        ? { ...origin, y: origin.y + offset }
        : { ...origin, x: origin.x + offset };
    }
    position = {
      x: flowchart.snap(position.x, snapToGrid),
      y: flowchart.snap(position.y, snapToGrid),
    };
    const placement = placementFor(
      { category: "transformacao" },
      flowchart.boxOf({}, position),
    );

    const created = await run(async () => {
      const operation = await call("operations", {
        method: "POST",
        body: JSON.stringify({
          flowchart_id: selectedFlowchartId,
          name: "Nova etapa",
          ...placement,
        }),
      });
      await call("flows", {
        method: "POST",
        body: JSON.stringify({
          flowchart_id: selectedFlowchartId,
          source_operation_id: source.id,
          target_operation_id: operation.id,
        }),
      });
      return operation;
    });
    if (created) {
      setSelection({ kind: "operation", id: created.id });
      setEditing({ id: created.id, value: created.name });
    }
  }

  function startConnection(event, operation) {
    event.stopPropagation();
    if (!canEdit || isBusy) {
      return;
    }
    svgRef.current.setPointerCapture(event.pointerId);
    setConnection({ sourceId: operation.id, ...toPoint(event) });
  }

  // Começa a arrastar o desvio (segmento do meio) de um fluxo.
  function startBend(event, flow, handle) {
    event.stopPropagation();
    if (!canEdit || isBusy) {
      return;
    }
    svgRef.current.setPointerCapture(event.pointerId);
    setBend({ flowId: flow.id, handle, ratio: null });
  }

  async function saveBendRatio(flow, value) {
    // Atualiza na hora para o traçado não "pular" até a recarga dos dados.
    setData((current) => ({
      ...current,
      flows: current.flows.map((entry) =>
        entry.id === flow.id ? { ...entry, bend_ratio: value } : entry,
      ),
    }));
    await run(() =>
      call(`flows/${flow.id}`, {
        method: "PATCH",
        body: JSON.stringify({ bend_ratio: value }),
      }),
    );
  }

  function startResize(event) {
    event.stopPropagation();
    if (!canEdit || isBusy) {
      return;
    }
    svgRef.current.setPointerCapture(event.pointerId);
    setResize({ width: area.width, height: area.height });
  }

  function handlePointerMove(event) {
    const point = toPoint(event);
    if (drag) {
      setDrag({
        ...drag,
        x: flowchart.snap(point.x - drag.dx, snapToGrid),
        y: flowchart.snap(point.y - drag.dy, snapToGrid),
        moved: true,
      });
    } else if (connection) {
      setConnection({ ...connection, ...point });
      setHoverId(flowchart.findOperationAt(boxes, point, connection.sourceId));
    } else if (bend) {
      const { handle } = bend;
      const position = handle.horizontal ? point.x : point.y;
      const ratio = (position - handle.start) / (handle.end - handle.start);
      setBend({
        ...bend,
        ratio: Math.round(Math.min(Math.max(ratio, 0.05), 0.95) * 100) / 100,
      });
    } else if (resize) {
      setResize({
        width: flowchart.snap(point.x - area.x, snapToGrid),
        height: flowchart.snap(point.y - area.y, snapToGrid),
      });
    }
  }

  async function finishResize() {
    const next = area;
    setAreas((current) => ({ ...current, [selectedFlowchartId]: next }));
    await run(async () => {
      await call(`flowcharts/${selectedFlowchartId}`, {
        method: "PATCH",
        body: JSON.stringify({
          boundary_width: next.width,
          boundary_height: next.height,
        }),
      });
      // Etapas que mudaram de lado do retângulo têm a fronteira atualizada.
      for (const operation of positioned) {
        const box = boxes.get(operation.id);
        const placement = placementFor(operation, box);
        if (placement.boundary !== operation.boundary) {
          await call(`operations/${operation.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              boundary: placement.boundary,
              category: placement.category,
            }),
          });
        }
      }
    });
  }

  async function handlePointerUp(event) {
    const current = { drag, connection, resize, bend };
    setDrag(null);
    setConnection(null);
    setResize(null);
    setBend(null);
    setHoverId(null);
    svgRef.current?.releasePointerCapture?.(event.pointerId);

    if (current.bend?.ratio !== null && current.bend) {
      const flow = data.flows.find((entry) => entry.id === current.bend.flowId);
      await saveBendRatio(flow, current.bend.ratio);
    }

    if (current.resize) {
      await finishResize();
    }

    if (current.drag?.moved) {
      const operation = operationsById.get(current.drag.id);
      const box = flowchart.boxOf(operation, current.drag);
      await run(() =>
        call(`operations/${operation.id}`, {
          method: "PATCH",
          body: JSON.stringify(placementFor(operation, box)),
        }),
      );
    }

    if (current.connection) {
      const targetId = flowchart.findOperationAt(
        boxes,
        toPoint(event),
        current.connection.sourceId,
      );
      if (targetId) {
        await run(async () => {
          const created = await call("flows", {
            method: "POST",
            body: JSON.stringify({
              flowchart_id: selectedFlowchartId,
              source_operation_id: current.connection.sourceId,
              target_operation_id: targetId,
            }),
          });
          setSelection({ kind: "flow", id: created.id });
        });
      }
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    const entry = PALETTE.find(
      (candidate) =>
        candidate.kind === event.dataTransfer.getData("text/plain"),
    );
    if (canEdit && entry) {
      addOperation(entry, toPoint(event));
    }
  }

  async function removeElement(collection, element) {
    const isOperation = collection === "operations";
    const confirmed = await confirm({
      title: `Remover ${isOperation ? "a etapa" : "o fluxo"}?`,
      content: isOperation
        ? "Os fluxos ligados a esta etapa também serão removidos."
        : "Os itens vinculados a este fluxo também serão removidos.",
      confirmButtonContent: "Remover",
      confirmButtonType: "danger",
      cancelButtonContent: "Cancelar",
    });
    if (confirmed) {
      setSelection(null);
      await run(() =>
        call(`${collection}/${element.id}`, { method: "DELETE" }),
      );
    }
  }

  async function removeItem(item) {
    const confirmed = await confirm({
      title: `Remover o item ${item.name}?`,
      content: "Ele também será retirado de todos os fluxos.",
      confirmButtonContent: "Remover",
      confirmButtonType: "danger",
      cancelButtonContent: "Cancelar",
    });
    if (confirmed) {
      setSelection(null);
      await run(() => call(`items/${item.id}`, { method: "DELETE" }));
    }
  }

  function handleKeyDown(event) {
    if (event.code === "Space") {
      event.preventDefault();
      setSpaceHeld(true);
      return;
    }
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      canEdit &&
      activeSelection &&
      activeSelection.kind !== "item"
    ) {
      event.preventDefault();
      const isOperation = activeSelection.kind === "operation";
      const source = isOperation ? operations : flows;
      removeElement(
        isOperation ? "operations" : "flows",
        source.find((entry) => entry.id === activeSelection.id),
      );
    }
  }

  function handleKeyUp(event) {
    if (event.code === "Space") {
      setSpaceHeld(false);
    }
  }

  // Space + botão esquerdo arrasta a área de desenho (pan).
  function handlePanStart(event) {
    if (!spaceHeld || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    canvasRef.current.setPointerCapture(event.pointerId);
    panRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: canvasRef.current.scrollLeft,
      top: canvasRef.current.scrollTop,
    };
    setIsPanning(true);
  }

  function handlePanMove(event) {
    const pan = panRef.current;
    if (!pan) {
      return;
    }
    canvasRef.current.scrollLeft = pan.left - (event.clientX - pan.x);
    canvasRef.current.scrollTop = pan.top - (event.clientY - pan.y);
  }

  function handlePanEnd(event) {
    if (!panRef.current) {
      return;
    }
    panRef.current = null;
    canvasRef.current.releasePointerCapture?.(event.pointerId);
    setIsPanning(false);
  }

  if (flowcharts.length === 0) {
    return (
      <Blankslate border>
        <Blankslate.Heading>Crie um fluxograma</Blankslate.Heading>
        <Blankslate.Description>
          Adicione um fluxograma acima para desenhar suas etapas e fluxos.
        </Blankslate.Description>
      </Blankslate>
    );
  }

  const connectionSource = connection && boxes.get(connection.sourceId);

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <Heading as="h2" className={styles.toolbarTitle}>
          Editor
        </Heading>
        <Select
          aria-label="Fluxograma"
          value={selectedFlowchartId}
          onChange={(event) => {
            setFlowchartId(event.target.value);
            setSelection(null);
          }}
        >
          {flowcharts.map((item) => (
            <Select.Option key={item.id} value={item.id}>
              {item.name}
            </Select.Option>
          ))}
        </Select>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(event) => setSnapToGrid(event.target.checked)}
          />
          Alinhar à grade
        </label>
        <Select
          aria-label="Zoom"
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
        >
          {[...new Set([...ZOOM_LEVELS, zoom])]
            .sort((a, b) => a - b)
            .map((level) => (
              <Select.Option key={level} value={level}>
                {Math.round(level * 100)}%
              </Select.Option>
            ))}
        </Select>
        <div className={styles.help} ref={helpRef}>
          <IconButton
            icon={QuestionIcon}
            aria-label="Ajuda: atalhos do editor"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((open) => !open)}
          />
          {helpOpen && (
            <div
              className={styles.helpPopover}
              role="dialog"
              aria-label="Atalhos do editor"
            >
              <Heading as="h3" className={styles.helpTitle}>
                Atalhos do editor
              </Heading>
              <dl className={styles.helpList}>
                {SHORTCUTS.map(([keys, description]) => (
                  <div key={keys}>
                    <dt>{keys}</dt>
                    <dd>{description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <Banner
          variant="critical"
          title="Não foi possível concluir a alteração"
          description={errorMessage}
        />
      )}

      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Elementos">
          <Heading as="h3" className={styles.panelTitle}>
            Etapas
          </Heading>
          {canEdit ? (
            <div className={styles.palette}>
              {PALETTE.map((entry) => (
                <Button
                  key={entry.kind}
                  block
                  draggable
                  leadingVisual={entry.icon}
                  disabled={isBusy}
                  onDragStart={(event) =>
                    event.dataTransfer.setData("text/plain", entry.kind)
                  }
                  onClick={() => addOperation(entry)}
                >
                  {entry.label}
                </Button>
              ))}
              <Text className={styles.hint}>
                Clique ou arraste para a área de desenho. Etapas dentro do
                retângulo do empreendimento são internas; fora dele, externas.
                Fluxos que cruzam a fronteira ficam em laranja.
              </Text>
            </div>
          ) : (
            <Text className={styles.hint}>Somente leitura.</Text>
          )}

          <Heading as="h3" className={styles.panelTitle}>
            Itens
          </Heading>
          {canEdit && (
            <form
              className={styles.palette}
              onSubmit={async (event) => {
                event.preventDefault();
                const created = await run(() =>
                  call("items", {
                    method: "POST",
                    body: JSON.stringify(newItem),
                  }),
                );
                if (created) {
                  setNewItem({ name: "", category: "" });
                }
              }}
            >
              <TextInput
                block
                required
                placeholder="Nome do item"
                aria-label="Nome do item"
                value={newItem.name}
                onChange={(event) =>
                  setNewItem({ ...newItem, name: event.target.value })
                }
              />
              <Select
                block
                aria-label="Categoria do item"
                value={newItem.category}
                onChange={(event) =>
                  setNewItem({ ...newItem, category: event.target.value })
                }
              >
                <Select.Option value="">Categoria</Select.Option>
                {flowchart.ITEM_CATEGORIES.map((category) => (
                  <Select.Option key={category.value} value={category.value}>
                    {category.label}
                  </Select.Option>
                ))}
              </Select>
              <Button
                type="submit"
                block
                leadingVisual={PlusIcon}
                disabled={isBusy}
              >
                Novo item
              </Button>
            </form>
          )}
          {data.items.map((item) => (
            <div key={item.id} className={styles.row}>
              <button
                type="button"
                className={
                  activeSelection?.kind === "item" &&
                  activeSelection.id === item.id
                    ? styles.itemButtonSelected
                    : styles.itemButton
                }
                onClick={() => setSelection({ kind: "item", id: item.id })}
              >
                {item.name}
                {item.category && (
                  <span className={styles.hint}> ({item.category})</span>
                )}
              </button>
              {canEdit && (
                <IconButton
                  type="button"
                  size="small"
                  variant="invisible"
                  icon={TrashIcon}
                  aria-label={`Remover item ${item.name}`}
                  disabled={isBusy}
                  onClick={() => removeItem(item)}
                />
              )}
            </div>
          ))}
        </aside>

        <div
          ref={canvasRef}
          className={`${styles.canvas} ${
            isPanning ? styles.panning : spaceHeld ? styles.panReady : ""
          }`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={() => setSpaceHeld(false)}
          onPointerDownCapture={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
          onPointerCancel={handlePanEnd}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <svg
            ref={svgRef}
            width={size.width * zoom}
            height={size.height * zoom}
            viewBox={`0 0 ${size.width} ${size.height}`}
            role="application"
            aria-label="Área de desenho do fluxograma"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerDown={() => {
              setSelection(null);
              setItemPopover(null);
            }}
            onDoubleClick={handleDoubleClick}
          >
            <defs>
              <pattern
                id="grid-minor"
                width={flowchart.GRID_SIZE}
                height={flowchart.GRID_SIZE}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${flowchart.GRID_SIZE} 0 L 0 0 0 ${flowchart.GRID_SIZE}`}
                  className={styles.gridMinor}
                />
              </pattern>
              <pattern
                id="grid-major"
                width={flowchart.GRID_SIZE * 5}
                height={flowchart.GRID_SIZE * 5}
                patternUnits="userSpaceOnUse"
              >
                <rect
                  width={flowchart.GRID_SIZE * 5}
                  height={flowchart.GRID_SIZE * 5}
                  fill="url(#grid-minor)"
                />
                <path
                  d={`M ${flowchart.GRID_SIZE * 5} 0 L 0 0 0 ${flowchart.GRID_SIZE * 5}`}
                  className={styles.gridMajor}
                />
              </pattern>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrow} />
              </marker>
              <marker
                id="arrow-cross"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrowCross} />
              </marker>
            </defs>
            <rect
              width={size.width}
              height={size.height}
              fill="url(#grid-major)"
            />

            <rect
              x={area.x}
              y={area.y}
              width={area.width}
              height={area.height}
              rx="8"
              className={styles.boundary}
              pointerEvents="none"
            />
            <text
              x={area.x + 12}
              y={area.y + 22}
              className={styles.boundaryLabel}
              pointerEvents="none"
            >
              Empreendimento
            </text>
            {canEdit && (
              <rect
                x={area.x + area.width - 8}
                y={area.y + area.height - 8}
                width="16"
                height="16"
                className={styles.resizeHandle}
                onPointerDown={startResize}
              />
            )}

            {flows.map((flow) => {
              const source = boxes.get(flow.source_operation_id);
              const target = boxes.get(flow.target_operation_id);
              if (!source || !target) {
                return null;
              }
              const ratio =
                bend?.flowId === flow.id && bend.ratio !== null
                  ? bend.ratio
                  : Number(flow.bend_ratio) || 0.5;
              const { points, middle, handle } = flowchart.flowGeometry(
                source,
                target,
                offsets.get(flow.id),
                ratio,
              );
              const path = points.map((p) => `${p.x},${p.y}`).join(" ");
              const isSelected =
                activeSelection?.kind === "flow" &&
                activeSelection.id === flow.id;
              const direction = flowchart.flowDirection(
                operationsById.get(flow.source_operation_id).boundary,
                operationsById.get(flow.target_operation_id).boundary,
              );
              const crosses = direction === "input" || direction === "output";
              const lines = [
                flow.label,
                ...flowItems
                  .filter((entry) => entry.flow_id === flow.id)
                  .map((entry) =>
                    flowchart.describeFlowItem(entry, itemName(entry.item_id)),
                  ),
              ].filter(Boolean);
              return (
                <g
                  key={flow.id}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelection({ kind: "flow", id: flow.id });
                    setItemPopover(null);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (canEdit && !isBusy) {
                      setItemPopover({ flowId: flow.id, ...toPoint(event) });
                    }
                  }}
                >
                  <polyline
                    points={path}
                    fill="none"
                    className={
                      isSelected
                        ? styles.lineSelected
                        : crosses
                          ? styles.lineCross
                          : styles.line
                    }
                    markerEnd={`url(#${crosses ? "arrow-cross" : "arrow"})`}
                  />
                  <polyline
                    points={path}
                    fill="none"
                    className={styles.lineHit}
                  />
                  {lines.map((text, index) => (
                    <text
                      key={index}
                      x={middle.x}
                      y={middle.y - 6 + index * 14}
                      textAnchor="middle"
                      className={styles.caption}
                    >
                      {text}
                    </text>
                  ))}
                  {isSelected && canEdit && handle && (
                    <circle
                      cx={handle.x}
                      cy={handle.y}
                      r="6"
                      className={
                        handle.horizontal
                          ? styles.bendHandleX
                          : styles.bendHandleY
                      }
                      onPointerDown={(event) => startBend(event, flow, handle)}
                    >
                      <title>Arraste para mover o desvio do fluxo</title>
                    </circle>
                  )}
                </g>
              );
            })}

            {operations.map((operation) => {
              const box = boxes.get(operation.id);
              const isSelected =
                activeSelection?.kind === "operation" &&
                activeSelection.id === operation.id;
              const showAnchors =
                canEdit &&
                (isSelected ||
                  hoverId === operation.id ||
                  (connection && connection.sourceId !== operation.id));
              const isSource = operation.category === "fonte";
              const isSink = operation.category === "sumidouro";
              const tag = isSource ? "Início" : isSink ? "Fim" : null;
              return (
                <g
                  key={operation.id}
                  onPointerEnter={() =>
                    !connection && !drag && setHoverId(operation.id)
                  }
                  onPointerLeave={() => !connection && setHoverId(null)}
                >
                  {showAnchors && !connection && (
                    <rect
                      x={box.x - 36}
                      y={box.y - 36}
                      width={box.width + 72}
                      height={box.height + 72}
                      fill="transparent"
                    />
                  )}
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    rx={isSource || isSink ? 30 : 6}
                    className={[
                      isSource
                        ? styles.sourceBox
                        : isSink
                          ? styles.sinkBox
                          : operation.boundary === "external"
                            ? styles.externalBox
                            : styles.box,
                      isSelected && styles.selected,
                      hoverId === operation.id && connection && styles.target,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onPointerDown={(event) => startDrag(event, operation)}
                  />
                  {tag && (
                    <text
                      x={box.x + box.width / 2}
                      y={box.y + 18}
                      textAnchor="middle"
                      className={styles.tag}
                      pointerEvents="none"
                    >
                      {tag}
                    </text>
                  )}
                  {editing?.id === operation.id ? (
                    <foreignObject
                      x={box.x + 6}
                      y={box.y + box.height / 2 + (tag ? -4 : -14)}
                      width={box.width - 12}
                      height="28"
                    >
                      <input
                        className={styles.labelInput}
                        aria-label="Nome da etapa"
                        value={editing.value}
                        maxLength={254}
                        autoFocus
                        onFocus={(event) => event.target.select()}
                        onChange={(event) =>
                          setEditing({ ...editing, value: event.target.value })
                        }
                        onBlur={() => editing && commitEditing(true)}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter" || event.key === "Escape") {
                            // Devolve o foco para os atalhos continuarem valendo.
                            canvasRef.current?.focus();
                            commitEditing(event.key === "Enter");
                          }
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => event.stopPropagation()}
                      />
                    </foreignObject>
                  ) : (
                    <text
                      x={box.x + box.width / 2}
                      y={box.y + box.height / 2 + (tag ? 10 : 4)}
                      textAnchor="middle"
                      className={styles.label}
                      pointerEvents="none"
                    >
                      {operation.name}
                    </text>
                  )}
                  {canEdit &&
                    hoverId === operation.id &&
                    !connection &&
                    !isSink &&
                    !editing && (
                      <>
                        {flowchart.anchorPoints(box).map((anchor) => (
                          <path
                            key={anchor.side}
                            d="M -8 -7 L 8 0 L -8 7 Z"
                            transform={`translate(${anchor.x + ARROW_OFFSETS[anchor.side].x} ${
                              anchor.y + ARROW_OFFSETS[anchor.side].y
                            }) rotate(${ARROW_OFFSETS[anchor.side].angle})`}
                            className={styles.nextArrow}
                            role="button"
                            aria-label={`Criar próxima etapa (${ARROW_OFFSETS[anchor.side].label})`}
                            onPointerDown={(event) => event.stopPropagation()}
                            // Sem isso o SVG limpa o hover e a seta some antes do click.
                            onPointerUp={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!isBusy) {
                                addNextOperation(operation, anchor.side);
                              }
                            }}
                          >
                            <title>Criar próxima etapa</title>
                          </path>
                        ))}
                      </>
                    )}
                  {showAnchors &&
                    flowchart
                      .anchorPoints(box)
                      .map((anchor) => (
                        <circle
                          key={anchor.side}
                          cx={anchor.x}
                          cy={anchor.y}
                          r="6"
                          className={styles.anchor}
                          onPointerDown={(event) =>
                            startConnection(event, operation)
                          }
                        />
                      ))}
                </g>
              );
            })}

            {itemPopover && canEdit && (
              <foreignObject
                x={itemPopover.x}
                y={itemPopover.y}
                width="230"
                height="230"
                style={{ overflow: "visible" }}
              >
                <FlowItemPopover
                  items={data.items}
                  disabled={isBusy}
                  onClose={() => setItemPopover(null)}
                  onSubmit={(entry) => addItemToFlow(itemPopover.flowId, entry)}
                />
              </foreignObject>
            )}

            {connection && connectionSource && (
              <DraftLine source={connectionSource} point={connection} />
            )}
          </svg>
        </div>

        <aside className={styles.sidebar} aria-label="Propriedades">
          <Heading as="h3" className={styles.panelTitle}>
            Propriedades
          </Heading>
          <Inspector
            selection={activeSelection}
            operations={operations}
            flows={flows}
            items={data.items}
            flowItems={flowItems}
            canEdit={canEdit}
            disabled={isBusy}
            onSave={(collection, id, values) =>
              run(() =>
                call(`${collection}/${id}`, {
                  method: "PATCH",
                  body: JSON.stringify(values),
                }),
              )
            }
            onRemove={(collection, element) =>
              collection === "items"
                ? removeItem(element)
                : removeElement(collection, element)
            }
            onAddFlowItem={(values) =>
              run(() =>
                call("flow_items", {
                  method: "POST",
                  body: JSON.stringify(values),
                }),
              )
            }
            onRemoveFlowItem={(flowItem) =>
              run(() => call(`flow_items/${flowItem.id}`, { method: "DELETE" }))
            }
          />
        </aside>
      </div>
    </div>
  );
}

function DraftLine({ source, point }) {
  const { from } = flowchart.flowGeometry(source, {
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
  });
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={point.x}
      y2={point.y}
      className={styles.lineDraft}
      markerEnd="url(#arrow)"
      pointerEvents="none"
    />
  );
}

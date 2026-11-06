import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  FormControl,
  Heading,
  Select,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import Link from "next/link";
import DefaultLayout from "../../../../../interface/DefaultLayout";
import MceCollectionStatus from "../../../../../interface/MceCollectionStatus";
import createProjectNavigation from "../../../../../interface/ProjectNavigation";
import useMceCollection from "../../../../../interface/useMceCollection";
import flowchart from "models/flowchart.js";

const title = "Balanço hídrico";
const description = "Água por fonte, uso e destino do fluxograma.";
const types = Object.fromEntries(
  flowchart.WATER_TYPES.map(({ value, label }) => [value, label]),
);
const uses = Object.fromEntries(
  flowchart.WATER_USES.map(({ value, label }) => [value, label]),
);

export default function WaterBalancePage() {
  const mce = useMceCollection("flowcharts");
  const [selected, setSelected] = useState("");
  const [period, setPeriod] = useState("ano");
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const chartId = mce.items.some((item) => item.id === selected)
    ? selected
    : mce.items[0]?.id;

  useEffect(() => {
    if (!chartId || !mce.projectId) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      setBalance(null);
      try {
        const response = await fetch(
          `/api/v1/projects/${mce.projectId}/mce/water-balance?flowchart_id=${encodeURIComponent(chartId)}`,
        );
        const body = await response.json();
        if (!response.ok) throw new Error(`${body.message} ${body.action}`);
        if (active) setBalance(body);
      } catch (failure) {
        if (active) setError(failure.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [mce.projectId, chartId, revision]);

  const factor = period === "mes" ? 1 / 12 : 1;
  const unit = period === "mes" ? "m³/mês" : "m³/ano";
  const format = (value) =>
    `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value * factor)} ${unit}`;
  const isReady = mce.loadingStatus === "success" && mce.hasMce;

  async function saveQuantity(row, quantity) {
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/projects/${mce.projectId}/mce/flow_items/${row.flow_item_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity, unit: "m³/ano" }),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(`${body.message} ${body.action}`);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <DefaultLayout
      subNavigation={createProjectNavigation(mce.projectId, "water-balance")}
      metadata={{ title, description }}
    >
      <Stack gap="spacious">
        {mce.projectName && <Heading as="h1">{mce.projectName}</Heading>}
        <MceCollectionStatus title={title} {...mce} />
        {isReady && (
          <>
            <div>
              <Heading as="h2">{title}</Heading>
              <Text>{description}</Text>
            </div>
            {!chartId ? (
              <Text>Cadastre um fluxograma para consultar o balanço.</Text>
            ) : (
              <>
                <FormControl>
                  <FormControl.Label>Fluxograma</FormControl.Label>
                  <Select
                    value={chartId}
                    onChange={(event) => setSelected(event.target.value)}
                  >
                    {mce.items.map((item) => (
                      <Select.Option key={item.id} value={item.id}>
                        {item.name}
                      </Select.Option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormControl.Label>Período de exibição</FormControl.Label>
                  <Select
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                  >
                    <Select.Option value="ano">Anual</Select.Option>
                    <Select.Option value="mes">
                      Média mensal estimada
                    </Select.Option>
                  </Select>
                </FormControl>
                {period === "mes" && (
                  <Text>
                    A média mensal é o volume anual dividido por 12; não
                    representa medições mensais.
                  </Text>
                )}
                <Link href={`/projetos/${mce.projectId}/mce/fluxogramas`}>
                  Abrir editor de fluxogramas
                </Link>
                {loading && <Text>Calculando...</Text>}
                {error && (
                  <Banner
                    variant="critical"
                    title="Não foi possível carregar ou salvar"
                    description={error}
                  />
                )}
                {balance && (
                  <>
                    {balance.warnings.length > 0 && (
                      <Banner
                        variant="warning"
                        title="Verifique as informações"
                        description={`${balance.warnings.length} aviso(s); confira os dados do balanço.`}
                      />
                    )}
                    {balance.warnings.map((warning, index) => (
                      <Text key={`${warning.flow_id}-${index}`}>
                        {warning.message}
                        {warning.flow_id && (
                          <>
                            {" "}
                            <Link
                              href={`/projetos/${mce.projectId}/mce/fluxogramas?flowchart_id=${encodeURIComponent(chartId)}&flow_id=${encodeURIComponent(warning.flow_id)}`}
                            >
                              Ver fluxo
                            </Link>
                          </>
                        )}
                      </Text>
                    ))}
                    <BalanceSection
                      title="Por fonte"
                      rows={balance.rows.filter((row) => row.input)}
                      label={(row) =>
                        `${row.source} (${types[row.source_type] ?? "tipo não informado"})`
                      }
                      format={format}
                    />
                    <BalanceSection
                      title="Por uso"
                      rows={balance.rows.filter((row) => row.group_id)}
                      label={(row) =>
                        `${uses[row.use] ?? "Não informado"}${row.reuse ? " — reúso" : ""}`
                      }
                      format={format}
                    />
                    <BalanceSection
                      title="Por destino"
                      rows={balance.rows.filter((row) => row.output)}
                      label={(row) =>
                        `${row.target} (${types[row.destination_type] ?? "tipo não informado"})`
                      }
                      format={format}
                    />
                    <Text>
                      Entradas contabilizadas: {format(balance.totals.input)} ·
                      Saídas contabilizadas: {format(balance.totals.output)}
                    </Text>
                    <Text>
                      Diferença entre entradas e saídas:{" "}
                      {balance.totals.difference === null
                        ? "não calculada: há pendências"
                        : format(balance.totals.difference)}
                      .
                    </Text>
                    <Text>
                      A diferença pode incluir perdas, incorporação ao produto,
                      uso consumptivo e variação de armazenamento. Uma saída
                      maior que a entrada exige verificação.
                    </Text>
                    <Heading as="h3">Movimentos considerados</Heading>
                    {balance.rows.map((row) => (
                      <WaterRow
                        key={`${row.flow_item_id}-${row.annual}`}
                        row={row}
                        format={format}
                        canEdit={mce.canEdit}
                        onSave={saveQuantity}
                        href={`/projetos/${mce.projectId}/mce/fluxogramas?flowchart_id=${encodeURIComponent(chartId)}&flow_id=${encodeURIComponent(row.flow_id)}`}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </Stack>
    </DefaultLayout>
  );
}

function BalanceSection({ title, rows, label, format }) {
  const totals = new Map();
  for (const row of rows) {
    const key = label(row);
    totals.set(key, (totals.get(key) ?? 0) + row.annual);
  }
  return (
    <section>
      <Heading as="h3">{title}</Heading>
      {totals.size ? (
        <ul>
          {[...totals].map(([name, value]) => (
            <li key={name}>
              {name}: {format(value)}
            </li>
          ))}
        </ul>
      ) : (
        <Text>Nenhum movimento com quantidade válida.</Text>
      )}
    </section>
  );
}

function WaterRow({ row, format, canEdit, onSave, href }) {
  const [quantity, setQuantity] = useState(String(row.annual));
  return (
    <div>
      <Text>
        {row.source} → {row.target} · {row.item}: {format(row.annual)}
      </Text>{" "}
      <Link href={href}>Ver fluxo</Link>
      {canEdit && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(row, quantity);
          }}
        >
          <FormControl required>
            <FormControl.Label>Quantidade anual em m³/ano</FormControl.Label>
            <TextInput
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </FormControl>{" "}
          <Button type="submit" size="small">
            Salvar
          </Button>
        </form>
      )}
    </div>
  );
}

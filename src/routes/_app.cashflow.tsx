import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getObligations, type Obligation } from "@/lib/api/obligations.functions";
import { TrendingUp, TrendingDown, Wallet, Plus, X, ChevronDown, RotateCcw, PenLine, ScanLine } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/cashflow")({
  // Las proyecciones viven en el localStorage del navegador: el servidor solo trae
  // los datos (obligaciones) y la pantalla se dibuja en el cliente, para que no
  // difiera de lo que renderizaría el servidor (sin acceso a localStorage).
  ssr: "data-only",
  loader: async () => {
    const obligations = await getObligations();
    return { obligations };
  },
  component: CashFlow,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Range        = "1m" | "3m" | "6m" | "1y";
// Ingresos y egresos que se proyectan a varios meses. "desde" (YYYY-MM) indica el
// primer mes en que aplican; sin "desde" aplican a todos los meses.
type IncomeSource = { id: string; nombre: string; importe: number; desde?: string };
type EgresoItem   = { id: string; emisor: string; monto: string; desde?: string };

function appliesTo(item: { desde?: string }, monthKey: string): boolean {
  return !item.desde || monthKey >= item.desde;
}

// Aplica una transformación a cada mes ya inicializado
function mapMonths(
  data: Record<string, MonthData>,
  fn: (m: MonthData) => MonthData,
): Record<string, MonthData> {
  return Object.fromEntries(
    Object.entries(data).map(([k, m]) => [k, m?.initialized ? fn(m) : m]),
  );
}

type MonthIngreso = { id: string; nombre: string; importe: number };
type MonthEgreso  = { id: string; concepto: string; importe: number };
type MonthData    = { initialized: boolean; ingresos: MonthIngreso[]; egresos: MonthEgreso[] };

// ─── localStorage ─────────────────────────────────────────────────────────────

const LS_SOURCES          = "primus_cf_sources";
const LS_EGRESO_OVERRIDES = "primus_cf_egreso_overrides";
const LS_EGRESO_MANUAL    = "primus_cf_egreso_manual";
const LS_MONTH_PROJ       = "primus_cf_month_proj";
const LS_EGRESO_IMPORTED  = "primus_cf_egreso_imported";

function lsGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
  catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const RANGE_LABELS:  Record<Range, string> = { "1m": "1 mes", "3m": "3 meses", "6m": "6 meses", "1y": "1 año" };
const RANGE_MONTHS:  Record<Range, number> = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 };
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTHS_FULL = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

// "2026-12" → "Diciembre 2026"
function monthFullLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS_FULL[Number(m) - 1]} ${y}`;
}

// Columnas de las subtarjetas mensuales según el período elegido
const SUB_GRID: Record<Range, string> = {
  "1m": "sm:grid-cols-3",
  "3m": "sm:grid-cols-3",
  "6m": "sm:grid-cols-3",
  "1y": "sm:grid-cols-3",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtArs(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000)
    return `ARS ${(abs / 1_000_000).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}M`;
  return `ARS ${abs.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function initEgresosFromStorage(obligations: Obligation[], importedIds: Set<string>): EgresoItem[] {
  const overrides = lsGet<Record<string, { monto: string; desde?: string }>>(LS_EGRESO_OVERRIDES, {});
  const manual    = lsGet<EgresoItem[]>(LS_EGRESO_MANUAL, []);
  const dbItems   = obligations
    .filter(o => importedIds.has(String(o.id_obligacion)))
    .map(o => {
      const id = String(o.id_obligacion);
      return {
        id,
        emisor: o.emisor,
        monto:  overrides[id]?.monto ?? String(Math.round(parseFloat(o.monto))),
        desde:  overrides[id]?.desde,
      };
    });
  return [...dbItems, ...manual];
}

function buildMonthList(range: Range): { key: string; label: string }[] {
  const today = new Date();
  return Array.from({ length: RANGE_MONTHS[range] }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + 1 + i, 1);
    return {
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    };
  });
}

// ─── Botón "+" ────────────────────────────────────────────────────────────────

// Destino de la ventana "+": ingresos o egresos, de todos los meses o de uno
type AddTarget = { kind: "ing" | "egr"; monthKey: string | null; label: string };

// Fondo de color de los botones de las tarjetas principales (verde ingresos, rojo egresos)
const TONE_BUTTON = {
  success:     "h-8 w-8 rounded-lg bg-success/10 text-success hover:bg-success/20",
  destructive: "h-8 w-8 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20",
} as const;

function AddButton({ onClick, title, small = false, tone }: {
  onClick: () => void; title: string; small?: boolean; tone?: keyof typeof TONE_BUTTON;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`grid place-items-center transition ${
        tone ? TONE_BUTTON[tone] :
        small ? "h-6 w-6 rounded-md bg-muted text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground"
              : "h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}>
      <Plus className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );
}

// ─── MonthSubcards ────────────────────────────────────────────────────────────
// Subtarjetas de un mes dentro de cada tarjeta principal (ingresos, egresos o
// saldo). Las de ingresos y egresos se despliegan para editar los conceptos del
// mes y tienen un "+" para agregar conceptos solo a ese mes.

type SubcardKind = "ing" | "egr" | "saldo";

function MonthSubcards({
  kind, range, months, monthData, setMonthData, onAdd, open = false,
}: {
  kind:         SubcardKind;
  range:        Range;
  months:       { key: string; label: string }[];
  monthData:    Record<string, MonthData>;
  setMonthData: React.Dispatch<React.SetStateAction<Record<string, MonthData>>>;
  onAdd:        (target: AddTarget) => void;
  open?:        boolean; // lo controla la flecha de la tarjeta principal
}) {

  const updateIngItem = (key: string, id: string, field: keyof MonthIngreso, raw: string) =>
    setMonthData(p => ({
      ...p,
      [key]: {
        ...p[key],
        ingresos: p[key].ingresos.map(i =>
          i.id !== id ? i : field === "importe" ? { ...i, importe: parseFloat(raw) || 0 } : { ...i, nombre: raw }
        ),
      },
    }));

  const removeIngItem = (key: string, id: string) =>
    setMonthData(p => ({ ...p, [key]: { ...p[key], ingresos: p[key].ingresos.filter(i => i.id !== id) } }));

  const updateEgrItem = (key: string, id: string, field: keyof MonthEgreso, raw: string) =>
    setMonthData(p => ({
      ...p,
      [key]: {
        ...p[key],
        egresos: p[key].egresos.map(e =>
          e.id !== id ? e : field === "importe" ? { ...e, importe: parseFloat(raw) || 0 } : { ...e, concepto: raw }
        ),
      },
    }));

  const removeEgrItem = (key: string, id: string) =>
    setMonthData(p => ({ ...p, [key]: { ...p[key], egresos: p[key].egresos.filter(e => e.id !== id) } }));

  return (
    <div className={`grid items-start gap-3 ${SUB_GRID[range]}`}>
      {months.map(m => {
        const data = monthData[m.key];
        const ing  = data?.ingresos.reduce((s, x) => s + x.importe, 0) ?? 0;
        const egr  = data?.egresos.reduce((s, x) => s + x.importe, 0) ?? 0;

        // ── Saldo: solo el resultado del mes ──
        if (kind === "saldo") {
          const saldo = ing - egr;
          const pos   = saldo >= 0;
          return (
            <div key={m.key} className={`rounded-xl border p-3 ${
              ing === 0 ? "border-border bg-card" :
              pos ? "border-success/30 bg-card" : "border-destructive/30 bg-card"
            }`}>
              <div className="flex h-8 items-center text-xs font-semibold text-foreground">{m.label}</div>
              <div className={`mt-3 flex h-8 items-center text-lg font-bold tracking-tight ${
                ing === 0 ? "text-muted-foreground" : pos ? "text-success" : "text-destructive"
              }`}>
                {ing > 0 ? `${pos ? "+" : "−"}${fmtArs(saldo)}` : "—"}
              </div>
            </div>
          );
        }

        const isIng = kind === "ing";
        const total = isIng ? ing : egr;
        const items = isIng
          ? (data?.ingresos ?? []).map(i => ({ id: i.id, nombre: i.nombre, importe: i.importe }))
          : (data?.egresos ?? []).map(e => ({ id: e.id, nombre: e.concepto, importe: e.importe }));

        return (
          <div key={m.key} className="rounded-xl border border-border bg-card p-3">
            <div className="flex h-8 items-center justify-between">
              <span className="text-xs font-semibold text-foreground">{m.label}</span>
              <div className="flex items-center gap-1">
                <AddButton small
                  title={`Agregar ${isIng ? "ingreso" : "egreso"} a ${m.label}`}
                  onClick={() => onAdd({ kind, monthKey: m.key, label: m.label })} />              </div>
            </div>
            <div className={`mt-3 flex h-8 items-center text-lg font-bold tracking-tight ${
              total === 0 ? "text-muted-foreground" : isIng ? "text-success" : "text-destructive"
            }`}>
              {total > 0 ? fmtArs(total) : "—"}
            </div>

            {open && (
              items.length > 0 ? (
                <div className="mt-4 space-y-1.5">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-1.5 rounded-xl bg-muted/40 px-2 py-1.5">
                      {/* Mismo estilo que la lista de la tarjeta principal: el nombre se ve
                          como texto y se edita al hacer clic */}
                      <input className="h-7 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 text-xs font-medium outline-none transition hover:border-border focus:border-border focus:bg-background"
                        value={item.nombre}
                        onChange={e => isIng
                          ? updateIngItem(m.key, item.id, "nombre", e.target.value)
                          : updateEgrItem(m.key, item.id, "concepto", e.target.value)} />
                      <input className="h-7 w-24 shrink-0 rounded-lg border border-border bg-background px-2 text-right text-xs"
                        type="text" inputMode="numeric"
                        value={item.importe ? fmtNum(item.importe) : ""}
                        onChange={e => isIng
                          ? updateIngItem(m.key, item.id, "importe", e.target.value.replace(/\D/g, ""))
                          : updateEgrItem(m.key, item.id, "importe", e.target.value.replace(/\D/g, ""))} />
                      <button onClick={() => isIng ? removeIngItem(m.key, item.id) : removeEgrItem(m.key, item.id)}
                        className="shrink-0 text-muted-foreground/50 transition hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-center text-xs text-muted-foreground">Sin {isIng ? "ingresos" : "egresos"} este mes.</p>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

function CashFlow() {
  const { obligations } = Route.useLoaderData();

  const [range, setRange] = useState<Range>("1m");

  const [sources, setSources] = useState<IncomeSource[]>(() => lsGet<IncomeSource[]>(LS_SOURCES, []));
  useEffect(() => { lsSet(LS_SOURCES, sources); }, [sources]);

  const [importedDbIds, setImportedDbIds] = useState<string[]>(() => lsGet<string[]>(LS_EGRESO_IMPORTED, []));
  useEffect(() => { lsSet(LS_EGRESO_IMPORTED, importedDbIds); }, [importedDbIds]);

  const [egresoItems, setEgresoItems] = useState<EgresoItem[]>(() => {
    const imported = new Set(lsGet<string[]>(LS_EGRESO_IMPORTED, []));
    return initEgresosFromStorage(obligations, imported);
  });
  useEffect(() => {
    const overrides: Record<string, { monto: string; desde?: string }> = {};
    egresoItems.forEach(e => {
      if (!e.id.startsWith("m_")) overrides[e.id] = { monto: e.monto, desde: e.desde };
    });
    lsSet(LS_EGRESO_OVERRIDES, overrides);
    lsSet(LS_EGRESO_MANUAL, egresoItems.filter(e => e.id.startsWith("m_")));
  }, [egresoItems]);

  const [monthData, setMonthData] = useState<Record<string, MonthData>>(
    () => lsGet<Record<string, MonthData>>(LS_MONTH_PROJ, {})
  );
  useEffect(() => { lsSet(LS_MONTH_PROJ, monthData); }, [monthData]);

  // Propagar ítems nuevos del panel izquierdo a meses ya inicializados
  useEffect(() => {
    setMonthData(prev => {
      let changed = false;
      const next: Record<string, MonthData> = {};
      for (const key of Object.keys(prev)) {
        const monthD = prev[key];
        if (!monthD?.initialized) { next[key] = monthD; continue; }
        const existingIngIds = new Set(monthD.ingresos.map(i => i.id));
        const newIngresos = sources
          .filter(s => !existingIngIds.has(s.id) && appliesTo(s, key))
          .map(s => ({ id: s.id, nombre: s.nombre, importe: s.importe }));
        const existingEgrIds = new Set(monthD.egresos.map(e => e.id));
        const newEgresos = egresoItems
          .filter(e => !existingEgrIds.has(e.id) && appliesTo(e, key))
          .map(e => ({ id: e.id, concepto: e.emisor, importe: parseFloat(e.monto) || 0 }));
        if (newIngresos.length > 0 || newEgresos.length > 0) {
          next[key] = {
            ...monthD,
            ingresos: [...monthD.ingresos, ...newIngresos],
            egresos:  [...monthD.egresos,  ...newEgresos],
          };
          changed = true;
        } else {
          next[key] = monthD;
        }
      }
      return changed ? next : prev;
    });
  }, [sources, egresoItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const months = buildMonthList(range);

  // Inicializar meses nuevos con los defaults actuales de la izquierda (solo una vez por mes).
  // También corre cuando cambia monthData: después de "Resetear" los meses quedan sin
  // inicializar y deben volver a tomar los ingresos y egresos que se carguen.
  useEffect(() => {
    setMonthData(prev => {
      const toInit = months.filter(m => !prev[m.key]?.initialized);
      if (toInit.length === 0) return prev;
      const next = { ...prev };
      toInit.forEach(m => {
        next[m.key] = {
          initialized: true,
          ingresos: sources.filter(s => appliesTo(s, m.key))
            .map(s => ({ id: s.id, nombre: s.nombre, importe: s.importe })),
          egresos:  egresoItems.filter(e => appliesTo(e, m.key))
            .map(e => ({ id: e.id, concepto: e.emisor, importe: parseFloat(e.monto) || 0 })),
        };
      });
      return next;
    });
  }, [months.map(m => m.key).join(","), monthData]); // eslint-disable-line react-hooks/exhaustive-deps

  const [incomesOpen, setIncomesOpen] = useState(false);
  const [egresosOpen, setEgresosOpen] = useState(false);

  // Ventana del botón "+": agrega ingresos o egresos a todos los meses (monthKey null)
  // o solo a un mes
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [addStep, setAddStep]     = useState<"choice" | "manual" | "import">("manual");
  const [proyectar, setProyectar] = useState(true);
  const [fNombre, setFNombre]     = useState("");
  const [fImporte, setFImporte]   = useState("");

  const monthlyIncome  = sources.reduce((s, x) => s + x.importe, 0);
  const monthlyEgresos = egresoItems.reduce((s, e) => s + (parseFloat(e.monto) || 0), 0);

  // Sumar valores reales de cada mes (respeta ediciones individuales)
  const projIngresos = months.reduce((sum, m) => {
    const data = monthData[m.key];
    return sum + (data?.initialized
      ? data.ingresos.reduce((s, x) => s + x.importe, 0)
      : monthlyIncome);
  }, 0);
  const projEgresos = months.reduce((sum, m) => {
    const data = monthData[m.key];
    return sum + (data?.initialized
      ? data.egresos.reduce((s, x) => s + x.importe, 0)
      : monthlyEgresos);
  }, 0);
  const saldo = projIngresos - projEgresos;
  const hasIncome      = sources.length > 0;
  const positive       = saldo >= 0;

  const availableObligations = obligations.filter(
    o => !importedDbIds.includes(String(o.id_obligacion))
  );

  // Editar un importe en la lista de la tarjeta principal lo actualiza también en
  // cada mes que tiene ese concepto (si no, el total y las subtarjetas no cambiarían)
  const updateEgresoMonto = (id: string, raw: string) => {
    setEgresoItems(p => p.map(e => e.id === id ? { ...e, monto: raw } : e));
    setMonthData(p => mapMonths(p, m => ({
      ...m, egresos: m.egresos.map(e => e.id === id ? { ...e, importe: Number(raw) || 0 } : e),
    })));
  };
  const updateSourceImporte = (id: string, raw: string) => {
    setSources(p => p.map(s => s.id === id ? { ...s, importe: Number(raw) || 0 } : s));
    setMonthData(p => mapMonths(p, m => ({
      ...m, ingresos: m.ingresos.map(i => i.id === id ? { ...i, importe: Number(raw) || 0 } : i),
    })));
  };
  const removeEgreso = (id: string) => {
    setEgresoItems(p => p.filter(e => e.id !== id));
    if (!id.startsWith("m_")) setImportedDbIds(p => p.filter(i => i !== id));
  };

  const importObligacion = (o: Obligation, desde?: string) => {
    const id = String(o.id_obligacion);
    const overrides = lsGet<Record<string, { monto: string }>>(LS_EGRESO_OVERRIDES, {});
    setEgresoItems(p => [...p, {
      id,
      emisor: o.emisor,
      monto:  overrides[id]?.monto ?? String(Math.round(parseFloat(String(o.monto)))),
      desde,
    }]);
    setImportedDbIds(p => [...p, id]);
  };

  // ── Ventana "+" ──────────────────────────────────────────────────────────────

  const openAdd = (target: AddTarget) => {
    setAddTarget(target);
    setAddStep(target.kind === "egr" ? "choice" : "manual");
    setFNombre(""); setFImporte("");
    // Desde la tarjeta principal se proyecta por defecto; desde un mes, no
    setProyectar(target.monthKey === null);
  };
  const closeAdd = () => setAddTarget(null);

  // Mes desde el que aplica lo que se agrega: el de la subtarjeta o el primero de la proyección
  const startKey   = addTarget?.monthKey ?? months[0].key;
  const startLabel = addTarget?.monthKey ? addTarget.label : months[0].label;
  // Alcance según "Proyectar": todos los meses, desde un mes en adelante o solo ese mes
  const alcance = !proyectar ? startLabel
    : addTarget?.monthKey === null ? "todos los meses"
    : `desde ${startLabel}`;
  const alcanceAviso = proyectar && addTarget?.monthKey !== null ? `${alcance} en adelante` : `a ${alcance}`;

  const proyectarCheck = (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4 cursor-pointer accent-primary"
        checked={proyectar} onChange={e => setProyectar(e.target.checked)} />
      Proyectar a los meses siguientes
    </label>
  );

  // Obligaciones que todavía no están en el destino
  const importables = !addTarget ? [] : proyectar
    ? availableObligations
    : obligations.filter(o =>
        !(monthData[startKey]?.egresos ?? []).some(e => e.id === String(o.id_obligacion)));

  const handleAddManual = () => {
    if (!addTarget) return;
    const imp = parseFloat(fImporte);
    const nombre = fNombre.trim();
    if (!nombre || isNaN(imp) || imp <= 0) return;
    const { kind, monthKey } = addTarget;
    if (proyectar) {
      // Proyectado: desde la tarjeta principal aplica a todos los meses; desde un mes,
      // a ese mes y los siguientes
      const desde = monthKey ?? undefined;
      if (kind === "ing") setSources(p => [...p, { id: `${Date.now()}`, nombre, importe: imp, desde }]);
      else setEgresoItems(p => [...p, { id: `m_${Date.now()}`, emisor: nombre, monto: String(imp), desde }]);
    } else {
      setMonthData(p => ({
        ...p,
        [startKey]: kind === "ing"
          ? { ...p[startKey], ingresos: [...p[startKey].ingresos, { id: `${Date.now()}`, nombre, importe: imp }] }
          : { ...p[startKey], egresos:  [...p[startKey].egresos,  { id: `${Date.now()}`, concepto: nombre, importe: imp }] },
      }));
    }
    toast.success(`${kind === "ing" ? "Ingreso" : "Egreso"} agregado ${alcanceAviso}.`);
    closeAdd();
  };

  const handleImport = (o: Obligation) => {
    if (!addTarget) return;
    if (proyectar) {
      importObligacion(o, addTarget.monthKey ?? undefined);
    } else {
      setMonthData(p => ({
        ...p,
        [startKey]: {
          ...p[startKey],
          egresos: [...p[startKey].egresos, {
            id:       String(o.id_obligacion),
            concepto: o.emisor,
            importe:  Math.round(parseFloat(String(o.monto))),
          }],
        },
      }));
    }
    toast.success(`${o.emisor} importada ${alcanceAviso}.`);
  };

  const handleResetProjections = () => {
    setSources([]);
    setEgresoItems([]);
    setImportedDbIds([]);
    setMonthData(prev => {
      const next: Record<string, MonthData> = {};
      Object.keys(prev).forEach(k => { next[k] = { initialized: false, ingresos: [], egresos: [] }; });
      return next;
    });
  };

  // Datos compartidos por las subtarjetas mensuales de las 3 tarjetas principales
  const subcardProps = { range, months, monthData, setMonthData, onAdd: openAdd };

  const generalIngresos = (
          <Card className="rounded-2xl border-success/20 bg-success/5 p-5 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col gap-5 lg:grid lg:grid-cols-4 lg:gap-3">
            <div className="min-w-0 lg:col-span-1 lg:border-y lg:border-transparent lg:py-3">
            <div className="flex h-8 items-center justify-between">
              <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-success" /> Ingresos proyectados
              </span>
              <div className="flex items-center gap-1.5">
                <AddButton tone="success" title="Agregar fuente de ingreso (todos los meses)"
                  onClick={() => openAdd({ kind: "ing", monthKey: null, label: "todos los meses" })} />
                <button onClick={() => setIncomesOpen(p => !p)} title={incomesOpen ? "Ocultar detalle" : "Ver detalle"}
                  className={`grid place-items-center transition ${TONE_BUTTON.success}`}>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${incomesOpen ? "" : "-rotate-90"}`} />
                </button>
              </div>
            </div>
            <div className="mt-3 flex h-8 items-center text-2xl font-bold tracking-tight text-success">
              {hasIncome ? fmtArs(projIngresos) : "—"}
            </div>

            {incomesOpen && (
              <>
                {sources.length === 0 && (
                  <p className="mt-4 text-center text-xs text-muted-foreground">Sin ingresos cargados. Usá + para agregar.</p>
                )}
                {sources.length > 0 && (
                  <div className="mt-4 space-y-1.5 lg:px-[13px]">
                    {sources.map(s => (
                      <div key={s.id} className="flex items-center gap-1.5 rounded-xl bg-success/10 px-2 py-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium">{s.nombre}</div>
                        </div>
                        <input className="h-7 w-24 shrink-0 rounded-lg border border-border bg-background px-2 text-right text-xs" type="text" inputMode="numeric"
                          value={s.importe ? s.importe.toLocaleString("es-AR", { maximumFractionDigits: 0 }) : ""}
                          onChange={ev => updateSourceImporte(s.id, ev.target.value.replace(/\D/g, ""))}
                          placeholder="Importe" />
                        <button onClick={() => setSources(p => p.filter(x => x.id !== s.id))}
                          className="shrink-0 text-muted-foreground/50 transition hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            </div>
            <div className="min-w-0 lg:col-span-3">
              <MonthSubcards kind="ing" {...subcardProps} open={incomesOpen} />
            </div>
            </div>
          </Card>
  );

  const generalEgresos = (
          <Card className="rounded-2xl border-destructive/20 bg-destructive/5 p-5 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col gap-5 lg:grid lg:grid-cols-4 lg:gap-3">
            <div className="min-w-0 lg:col-span-1 lg:border-y lg:border-transparent lg:py-3">
            <div className="flex h-8 items-center justify-between">
              <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <TrendingDown className="h-4 w-4 text-destructive" /> Egresos proyectados
              </span>
              <div className="flex items-center gap-1.5">
                <AddButton tone="destructive" title="Agregar egreso (todos los meses)"
                  onClick={() => openAdd({ kind: "egr", monthKey: null, label: "todos los meses" })} />
                <button onClick={() => setEgresosOpen(p => !p)} title={egresosOpen ? "Ocultar detalle" : "Ver detalle"}
                  className={`grid place-items-center transition ${TONE_BUTTON.destructive}`}>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${egresosOpen ? "" : "-rotate-90"}`} />
                </button>
              </div>
            </div>
            <div className="mt-3 flex h-8 items-center text-2xl font-bold tracking-tight text-destructive">
              {projEgresos > 0 ? fmtArs(projEgresos) : "—"}
            </div>

            {egresosOpen && (
              <>
                {egresoItems.length > 0 ? (
                  <div className="mt-4 space-y-1.5 lg:px-[13px]">
                    {egresoItems.map(e => (
                      <div key={e.id} className="flex items-center gap-1.5 rounded-xl bg-destructive/10 px-2 py-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium">{e.emisor}</div>
                        </div>
                        <input className="h-7 w-24 shrink-0 rounded-lg border border-border bg-background px-2 text-right text-xs" type="text" inputMode="numeric"
                          value={e.monto ? Number(e.monto).toLocaleString("es-AR", { maximumFractionDigits: 0 }) : ""}
                          onChange={ev => updateEgresoMonto(e.id, ev.target.value.replace(/\D/g, ""))}
                          placeholder="Importe" />
                        <button onClick={() => removeEgreso(e.id)}
                          className="shrink-0 text-muted-foreground/50 transition hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-center text-xs text-muted-foreground">Sin egresos cargados. Usá + para agregar.</p>
                )}
              </>
            )}
            </div>
            <div className="min-w-0 lg:col-span-3">
              <MonthSubcards kind="egr" {...subcardProps} open={egresosOpen} />
            </div>
            </div>
          </Card>
  );

  const generalSaldo = (
          <Card className={`rounded-2xl border p-5 shadow-[var(--shadow-soft)] ${
            !hasIncome ? "border-border" :
            positive ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
          }`}>
            <div className="flex flex-col gap-5 lg:grid lg:grid-cols-4 lg:gap-3">
            <div className="min-w-0 lg:col-span-1 lg:border-y lg:border-transparent lg:py-3">
            <div className="flex h-8 items-center justify-between">
              <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Wallet className={`h-4 w-4 ${
                  !hasIncome ? "text-muted-foreground" : positive ? "text-success" : "text-destructive"
                }`} /> Saldo proyectado
              </span>
            </div>
            <div className={`mt-3 flex h-8 items-center text-2xl font-bold tracking-tight ${
              !hasIncome ? "text-muted-foreground" : positive ? "text-success" : "text-destructive"
            }`}>
              {hasIncome ? `${positive ? "+" : "−"}${fmtArs(saldo)}` : "—"}
            </div>
            </div>
            <div className="min-w-0 lg:col-span-3">
              <MonthSubcards kind="saldo" {...subcardProps} />
            </div>
            </div>
          </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">
            Proyección · {monthFullLabel(months[0].key)}
            {months.length > 1 && ` - ${monthFullLabel(months[months.length - 1].key)}`}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleResetProjections}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-destructive/40 hover:text-destructive">
            <RotateCcw className="h-3.5 w-3.5" /> Resetear
          </button>
          <div className="inline-flex rounded-xl bg-muted p-1 text-xs">
            {(["1m", "3m", "6m", "1y"] as Range[]).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}>
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {generalIngresos}
        {generalEgresos}
        {generalSaldo}
      </div>

      {/* Ventana del botón "+": ingresos (formulario) o egresos (carga manual o importar) */}
      <Dialog open={!!addTarget} onOpenChange={(v) => { if (!v) closeAdd(); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addTarget?.kind === "ing" ? "Nuevo ingreso" : "Nuevo egreso"}
              {addTarget && <span className="font-normal text-muted-foreground"> · {alcance}</span>}
            </DialogTitle>
            <DialogDescription>
              {addStep === "choice" ? "¿Cómo querés registrar el egreso?" :
               addStep === "import" ? "Elegí las obligaciones a importar." :
               `Completá los datos del ${addTarget?.kind === "ing" ? "ingreso" : "egreso"}.`}
            </DialogDescription>
          </DialogHeader>

          {/* Egresos: elegir método */}
          {addStep === "choice" && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <button onClick={() => setAddStep("manual")}
                className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/30 p-5 text-center transition hover:border-primary/40 hover:bg-primary/5">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <PenLine className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Carga manual</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Ingresá concepto e importe</div>
                </div>
              </button>
              <button onClick={() => setAddStep("import")}
                className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/30 p-5 text-center transition hover:border-primary/40 hover:bg-primary/5">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ScanLine className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Importar desde Obligaciones</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {importables.length} {importables.length === 1 ? "disponible" : "disponibles"}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Formulario: ingreso o egreso manual */}
          {addStep === "manual" && (
            <form onSubmit={(e) => { e.preventDefault(); handleAddManual(); }} className="mt-2 space-y-3">
              <div>
                <Label>{addTarget?.kind === "ing" ? "Fuente de ingreso" : "Concepto"}</Label>
                <Input className="mt-1.5 h-10 rounded-xl" autoFocus
                  placeholder={addTarget?.kind === "ing" ? "Sueldo, Honorarios, Jubilación…" : "Alquiler, Seguro, Cuota…"}
                  value={fNombre} onChange={e => setFNombre(e.target.value)} />
              </div>
              <div>
                <Label>Importe{proyectar ? " mensual" : ""} (ARS)</Label>
                <Input className="mt-1.5 h-10 rounded-xl" type="text" inputMode="numeric" placeholder="Ej: 500.000"
                  value={fImporte ? Number(fImporte).toLocaleString("es-AR", { maximumFractionDigits: 0 }) : ""}
                  onChange={e => setFImporte(e.target.value.replace(/\D/g, ""))} />
              </div>
              {proyectarCheck}
              <div className="flex gap-2">
                {addTarget?.kind === "egr" ? (
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => setAddStep("choice")}>
                    Volver
                  </Button>
                ) : (
                  <Button type="button" variant="outline" className="rounded-xl" onClick={closeAdd}>
                    Cancelar
                  </Button>
                )}
                <Button type="submit" className="flex-1 rounded-xl shadow-[var(--shadow-glow)]"
                  disabled={!fNombre.trim() || !fImporte}>
                  Agregar {addTarget?.kind === "ing" ? "ingreso" : "egreso"}
                </Button>
              </div>
            </form>
          )}

          {/* Importar obligaciones */}
          {addStep === "import" && (
            <div className="mt-2 space-y-3">
              {proyectarCheck}
              {importables.length > 0 ? (
                <div className="max-h-80 space-y-1.5 overflow-y-auto">
                  {importables.map(o => (
                    <div key={o.id_obligacion} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {o.pagado && <span className="shrink-0 rounded-md bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">Pagada</span>}
                          <span className="truncate text-sm font-medium">{o.emisor}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ARS {Number(o.monto).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · vence{" "}
                          {new Date(o.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="ml-2 shrink-0 rounded-lg" onClick={() => handleImport(o)}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Importar
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No hay obligaciones para importar.
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setAddStep("choice")}>Volver</Button>
                <Button className="flex-1 rounded-xl" onClick={closeAdd}>Listo</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

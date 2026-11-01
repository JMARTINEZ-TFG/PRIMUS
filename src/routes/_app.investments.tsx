import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TrendingUp, Sparkles, Trophy, Info, ChevronDown,
} from "lucide-react";

// ─── Logo helpers ─────────────────────────────────────────────────────────────

// Logos locales en /public/logos/ — tienen prioridad sobre Google Favicon
const LOCAL_LOGOS: Record<string, string> = {
  "Ualá":                       "/logos/uala.png",
  "Banco Bica (hasta $750K)":   "/logos/bica.png",
  "Banco Bica ($750K–$2.25M)":  "/logos/bica.png",
  "Banco Bica ($2.25M–$20M)":   "/logos/bica.png",
  "Banco Bica (> $20M)":        "/logos/bica.png",
  "Banco Supervielle":          "/logos/supervielle.png",
  "Supervielle Hit IOL":        "/logos/supervielle.png",
  "Cresium":                    "/logos/cresium.png",
  "Personal Pay":               "/logos/personal-pay.png",
  "Banco Galicia":              "/logos/galicia.png",
};

// Logos via Google Favicon para el resto
const CR_LOGO_DOMAINS: Record<string, string> = {
  "Naranja X":                  "naranjax.com",
  "Ualá":                       "uala.com.ar",
  "Ualá Plus":                  "uala.com.ar",
  "Ualá Plus (max)":            "uala.com.ar",
  "Brubank":                    "brubank.com.ar",
  "Fiwind":                     "fiwind.io",
  "Carrefour Banco":            "carrefour.com.ar",
  "Banco Nación":               "bna.com.ar",
  "Belo":                       "belo.app",
  "Montemar Pay":               "montemarpay.com.ar",
  "Mercado Pago":               "mercadopago.com.ar",
  "Lemon Cash":                 "lemon.me",
  "Cocos":                      "cocos.capital",
};

function crLogoUrl(nombre: string): string | null {
  if (LOCAL_LOGOS[nombre]) return LOCAL_LOGOS[nombre];
  const d = CR_LOGO_DOMAINS[nombre];
  return d ? `https://www.google.com/s2/favicons?domain=${d}&sz=64` : null;
}

// Logos para PF sin URL del BCRA — local primero, Google Favicon como fallback
const PF_LOGO_OVERRIDES: Record<string, string> = {
  "Ualá":    "/logos/uala.png",
  "Brubank": "https://www.google.com/s2/favicons?domain=brubank.com.ar&sz=64",
};

// Genera un color HSL determinístico a partir del nombre
function nameColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h},55%,42%)`;
}

function EntityLogo({ src, name }: { src: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const letter = name.replace(/^Banco /, "").charAt(0).toUpperCase();

  if (!src || err) {
    return (
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-sm font-bold text-white"
        style={{ backgroundColor: nameColor(name) }}
      >
        {letter}
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-border bg-white">
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain"
        onError={() => setErr(true)}
      />
    </div>
  );
}
import {
  getPlazofijo, getCuentasRemuneradas,
  type PlazofijRate, type CuentaRemunRate, type CuentaVariante,
} from "@/lib/api/rates.functions";
import { getUserAccounts } from "@/lib/api/accounts.functions";
import { getObligations } from "@/lib/api/obligations.functions";
import { getTipoCambio } from "@/lib/api/fx.functions";

export const Route = createFileRoute("/_app/investments")({
  loader: async () => {
    const [plazofijo, { billeteras, fci }, accounts, obligations, tipoCambio] = await Promise.all([
      getPlazofijo(),
      getCuentasRemuneradas(),
      getUserAccounts(),
      getObligations(),
      getTipoCambio(),
    ]);
    const totalArs = accounts.reduce((s, a) => s + parseFloat(a.saldo_actual) * (a.moneda === "USD" ? tipoCambio.valor : 1), 0);
    const today = new Date();
    const totalVencidas = obligations
      .filter(o => !o.pagado)
      .filter(o => new Date(o.fecha_vencimiento + "T12:00:00") <= today)
      .reduce((s, o) => s + parseFloat(o.monto), 0);
    const fondosOciosos = Math.max(0, Math.round(totalArs - totalVencidas));
    return { plazofijo, billeteras, fci, defaultAmount: fondosOciosos };
  },
  component: Investments,
});

// Plazo fijo — interés simple (estándar argentino)
function gainPf(amount: number, tna: number, days: number): number {
  return Math.round(amount * (tna / 100) * (days / 365));
}

// Cuenta remunerada — capitalización diaria sobre TEA
function gainCr(amount: number, tea: number, days: number): number {
  return Math.round(amount * (Math.pow(1 + tea / 100, days / 365) - 1));
}

// ─── Otras modalidades de una misma cuenta (p. ej. Frascos de Naranja X) ──────

function VerMasOfertas({ count, abierta, onToggle }: { count: number; abierta: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
    >
      <ChevronDown className={`h-3 w-3 transition ${abierta ? "rotate-180" : ""}`} />
      {abierta ? "Ocultar" : "Ver"} {count} {count === 1 ? "oferta más" : "ofertas más"}
    </button>
  );
}

function VariantesList({ variantes, amount, days }: { variantes: CuentaVariante[]; amount: number; days: number }) {
  return (
    <div className="ml-6 space-y-1.5 border-l-2 border-border pl-3">
      {variantes.map((v) => (
        <div
          key={v.nombre}
          className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
        >
          <div className="min-w-[150px] flex-1 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{v.nombre}</span>
            {[v.tope, v.condicionesCorto].filter(Boolean).map((t) => ` · ${t}`).join("")}
          </div>
          <div className="text-xs font-semibold">TNA {v.tna.toFixed(2)}%</div>
          <div className="text-xs font-semibold">TEA {v.tea.toFixed(1)}%</div>
          <div className="w-28 text-right text-xs font-semibold text-success">
            +ARS {gainCr(amount, v.tea, days).toLocaleString("es-AR")}
          </div>
        </div>
      ))}
    </div>
  );
}

const PLAZOS = [30, 60, 90, 180, 365];

function Investments() {
  const { plazofijo, billeteras, fci, defaultAmount } = Route.useLoaderData();
  const [tab, setTab]                        = useState<"pf" | "cr" | "fci" | "all">("all");
  const [amount, setAmount]                  = useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("primus_fondos_ociosos");
      if (stored !== null) return Number(stored);
    }
    return defaultAmount;
  });
  const [inputStr, setInputStr]              = useState(() => amount.toLocaleString("es-AR", { maximumFractionDigits: 0 }));
  const amountRef                            = useRef<HTMLInputElement>(null);
  const [days, setDays]                      = useState(30);
  const [showNoClientes, setShowNoClientes]  = useState(false);
  const [selectedPfIdx, setSelectedPfIdx]    = useState(0);
  const [selectedCrIdx, setSelectedCrIdx]    = useState(0);
  const [selectedFciIdx, setSelectedFciIdx]  = useState(0);
  const [selectedAllIdx, setSelectedAllIdx]  = useState(0);
  const [expandida, setExpandida]            = useState<string | null>(null);
  const toggleExpandida = (key: string) => setExpandida((k) => (k === key ? null : key));

  const pfSorted  = [...plazofijo].sort((a, b) =>
    showNoClientes ? b.tnaNoClientes - a.tnaNoClientes : b.tnaClientes - a.tnaClientes,
  );
  const crSorted  = [...billeteras];
  const fciSorted = [...fci];

  type ConsolidadoItem = {
    nombre: string;
    tipo: "Plazo Fijo" | "Cuenta Remunerada" | "FCI";
    tna: number;
    tea: number;
    logoSrc: string | null;
    variantes?: CuentaVariante[];
  };
  const consolidado: ConsolidadoItem[] = [
    ...pfSorted.map(r => ({
      nombre:  r.entidad,
      tipo:    "Plazo Fijo" as const,
      tna:     showNoClientes ? r.tnaNoClientes : r.tnaClientes,
      tea:     r.tea,
      logoSrc: PF_LOGO_OVERRIDES[r.entidad] ?? r.logo ?? null,
    })),
    ...crSorted.map(r => ({
      nombre:  r.nombre,
      tipo:    "Cuenta Remunerada" as const,
      tna:     r.tna,
      tea:     r.tea,
      logoSrc: crLogoUrl(r.nombre),
      variantes: r.variantes,
    })),
    ...fciSorted.map(r => ({
      nombre:  r.nombre,
      tipo:    "FCI" as const,
      tna:     r.tna,
      tea:     r.tea,
      logoSrc: crLogoUrl(r.nombre),
    })),
  ].sort((a, b) => b.tea - a.tea);

  // Al cambiar el toggle clientes/no-clientes, resetear selección al primero
  const handleToggleClientes = (noClientes: boolean) => {
    setShowNoClientes(noClientes);
    setSelectedPfIdx(0);
    setSelectedAllIdx(0);
  };

  // Al cambiar de tab, resetear selección
  const handleTabChange = (t: "pf" | "cr" | "fci" | "all") => {
    setTab(t);
    setSelectedPfIdx(0);
    setSelectedCrIdx(0);
    setSelectedFciIdx(0);
    setSelectedAllIdx(0);
  };

  const selPf  = pfSorted[selectedPfIdx]     as PlazofijRate    | undefined;
  const selCr  = crSorted[selectedCrIdx]     as CuentaRemunRate | undefined;
  const selFci = fciSorted[selectedFciIdx]   as CuentaRemunRate | undefined;
  const selAll = consolidado[selectedAllIdx] as ConsolidadoItem | undefined;

  // Simulación de la opción seleccionada en la pestaña activa
  const simulacion = (() => {
    if (tab === "pf" && selPf) {
      const tna = showNoClientes ? selPf.tnaNoClientes : selPf.tnaClientes;
      return { titulo: `${selPf.entidad} · Plazo Fijo ${days} días`, ganancia: gainPf(amount, tna, days), tna, tea: selPf.tea };
    }
    if (tab === "cr" && selCr) {
      return { titulo: `${selCr.nombre} · Cuenta Remunerada ${days} días`, ganancia: gainCr(amount, selCr.tea, days), tna: selCr.tna, tea: selCr.tea };
    }
    if (tab === "fci" && selFci) {
      return { titulo: `${selFci.nombre} · Fondo Money Market ${days} días`, ganancia: gainCr(amount, selFci.tea, days), tna: selFci.tna, tea: selFci.tea };
    }
    if (tab === "all" && selAll) {
      const ganancia = selAll.tipo === "Plazo Fijo" ? gainPf(amount, selAll.tna, days) : gainCr(amount, selAll.tea, days);
      return { titulo: `${selAll.nombre} · ${selAll.tipo} · ${days} días`, ganancia, tna: selAll.tna, tea: selAll.tea };
    }
    return null;
  })();

  return (
    <div className="space-y-6">

      {/* Simulador */}
      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">Simulador</h3>
            <p className="text-xs text-muted-foreground">
              Seleccioná una opción del ranking para simular el rendimiento.
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 md:items-end">
            <div>
              <Label htmlFor="amount">Monto a colocar (ARS)</Label>
              <Input
                ref={amountRef}
                id="amount"
                type="text"
                inputMode="numeric"
                value={inputStr}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const pos = e.target.selectionStart ?? e.target.value.length;
                  const digitsAntes = e.target.value.slice(0, pos).replace(/\D/g, "").length;
                  const raw = e.target.value.replace(/\D/g, "");
                  if (!raw) { setInputStr(""); setAmount(0); return; }
                  const num = Number(raw);
                  const fmt = num.toLocaleString("es-AR", { maximumFractionDigits: 0 });
                  setInputStr(fmt);
                  setAmount(num);
                  requestAnimationFrame(() => {
                    const el = amountRef.current;
                    if (!el) return;
                    let count = 0; let newPos = fmt.length;
                    for (let i = 0; i < fmt.length; i++) {
                      if (/\d/.test(fmt[i]) && ++count === digitsAntes) { newPos = i + 1; break; }
                    }
                    el.setSelectionRange(newPos, newPos);
                  });
                }}
                className="mt-1.5 h-12 rounded-xl text-lg font-semibold"
              />
            </div>
            <div>
              <Label>Plazo</Label>
              <div className="mt-1.5 flex gap-1.5">
                {PLAZOS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${
                      days === d
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {d === 365 ? "1 año" : `${d}d`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {simulacion && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[image:var(--gradient-primary)] p-4 text-primary-foreground shadow-[var(--shadow-glow)]">
                <div className="text-xs opacity-90">{simulacion.titulo}</div>
                <div className="mt-1 text-2xl font-bold tracking-tight">
                  + ARS {simulacion.ganancia.toLocaleString("es-AR")}
                </div>
                <div className="text-xs opacity-90">
                  TNA {simulacion.tna.toFixed(2)}% · TEA {simulacion.tea.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total a cobrar</div>
                <div className="mt-1 text-xl font-bold">
                  ARS {(amount + simulacion.ganancia).toLocaleString("es-AR")}
                </div>
                <div className="text-xs text-muted-foreground">
                  capital ARS {amount.toLocaleString("es-AR")} + intereses ARS {simulacion.ganancia.toLocaleString("es-AR")}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex w-full gap-1 rounded-xl border border-border bg-muted/40 p-1">
        <button
          onClick={() => handleTabChange("all")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === "all" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Consolidado
        </button>
        <button
          onClick={() => handleTabChange("pf")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === "pf" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Plazo Fijo
        </button>
        <button
          onClick={() => handleTabChange("cr")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === "cr" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Cuentas Remuneradas
        </button>
        <button
          onClick={() => handleTabChange("fci")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === "fci" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Fondos Comunes de Inversión
        </button>
      </div>

      {/* ── TAB: Plazo Fijo ── */}
      {tab === "pf" && (
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Ranking Plazo Fijo</h3>
              <p className="text-xs text-muted-foreground">
                Entidades Bancarias · Acreditación Periódica · Fuente: BCRA, Régimen de Transparencia (actualización automática)
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
              <button
                onClick={() => handleToggleClientes(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${!showNoClientes ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Para clientes
              </button>
              <button
                onClick={() => handleToggleClientes(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${showNoClientes ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Sin cuenta
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {pfSorted.map((r, i) => {
              const tna       = showNoClientes ? r.tnaNoClientes : r.tnaClientes;
              const gain      = gainPf(amount, tna, days);
              const isFirst   = i === 0;
              const isSelected = i === selectedPfIdx;
              return (
                <button
                  key={r.entidad}
                  type="button"
                  onClick={() => setSelectedPfIdx(i)}
                  className={`w-full text-left flex flex-wrap items-center gap-3 rounded-xl border p-3.5 transition ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                    isSelected
                      ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {isFirst && !isSelected ? <Trophy className="h-4 w-4" /> : isFirst ? <Trophy className="h-4 w-4" /> : `#${i + 1}`}
                  </div>
                  <EntityLogo src={PF_LOGO_OVERRIDES[r.entidad] ?? r.logo ?? null} name={r.entidad} />
                  <div className="min-w-[150px] flex-1">
                    <div className="text-sm font-semibold">{r.entidad}</div>
                    {r.condicionesCorto && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">{r.condicionesCorto}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TNA</div>
                    <div className={`text-sm font-bold ${isSelected ? "text-primary" : "text-primary"}`}>{tna.toFixed(2)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TEA</div>
                    <div className="text-sm font-semibold">{r.tea.toFixed(1)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{days === 365 ? "1 año" : `${days} días`}</div>
                    <div className="text-sm font-bold text-success">+ARS {gain.toLocaleString("es-AR")}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Esta información tiene carácter exclusivamente informativo y no constituye asesoramiento de inversión. Las tasas corresponden a TNA para plazos fijos a 30 días para clientes informados al BCRA y pueden no reflejar las condiciones vigentes. No todas las alternativas conllevan el mismo riesgo. Verificá siempre con cada entidad antes de invertir. Primus no recibe comisión de ninguna entidad.
            </span>
          </div>
        </Card>
      )}

      {/* ── TAB: Cuentas Remuneradas ── */}
      {tab === "cr" && (
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Ranking Cuentas Remuneradas</h3>
              <p className="text-xs text-muted-foreground">
                Billeteras Virtuales y Bancos Digitales · Acreditación Diaria · Fuente: ArgentinaDatos (actualización automática)
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {crSorted.map((r, i) => {
              const gain       = gainCr(amount, r.tea, days);
              const isFirst    = i === 0;
              const isSelected = i === selectedCrIdx;
              const expKey     = `cr-${r.nombre}`;
              return (
                <div key={`${r.nombre}-${i}`} className="space-y-1.5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedCrIdx(i)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedCrIdx(i); } }}
                  className={`w-full cursor-pointer text-left flex flex-wrap items-center gap-3 rounded-xl border p-3.5 transition ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                    isSelected
                      ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {isFirst ? <Trophy className="h-4 w-4" /> : `#${i + 1}`}
                  </div>
                  <EntityLogo src={crLogoUrl(r.nombre)} name={r.nombre} />
                  <div className="min-w-[150px] flex-1">
                    <div className="text-sm font-semibold">{r.nombre}</div>
                    {(r.condicionesCorto ?? r.tope) && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                        {[r.tope, r.condicionesCorto].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {r.variantes && (
                      <VerMasOfertas
                        count={r.variantes.length}
                        abierta={expandida === expKey}
                        onToggle={() => toggleExpandida(expKey)}
                      />
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TNA</div>
                    <div className="text-sm font-bold text-primary">{r.tna.toFixed(2)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TEA</div>
                    <div className="text-sm font-semibold">{r.tea.toFixed(1)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{days === 365 ? "1 año" : `${days} días`}</div>
                    <div className="text-sm font-bold text-success">+ARS {gain.toLocaleString("es-AR")}</div>
                  </div>
                </div>
                {r.variantes && expandida === expKey && (
                  <VariantesList variantes={r.variantes} amount={amount} days={days} />
                )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Esta información tiene carácter exclusivamente informativo y no constituye asesoramiento de inversión. Los rendimientos proyectados son estimativos y pueden variar. No todas las alternativas conllevan el mismo riesgo. Verificá siempre las condiciones con cada entidad antes de invertir. Primus no recibe comisión de ninguna entidad.
            </span>
          </div>
        </Card>
      )}

      {/* ── TAB: Fondos Money Market ── */}
      {tab === "fci" && (
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <div>
            <h3 className="text-base font-semibold">Ranking Fondos Comunes de Inversión</h3>
            <p className="text-xs text-muted-foreground">
              Fondos Money Market · Liquidez Inmediata · Fuente: ArgentinaDatos (actualización automática)
            </p>
          </div>

          <div className="mt-5 space-y-2.5">
            {fciSorted.map((r, i) => {
              const gain       = gainCr(amount, r.tea, days);
              const isFirst    = i === 0;
              const isSelected = i === selectedFciIdx;
              return (
                <button
                  key={`${r.nombre}-${i}`}
                  type="button"
                  onClick={() => setSelectedFciIdx(i)}
                  className={`w-full text-left flex flex-wrap items-center gap-3 rounded-xl border p-3.5 transition ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                    isSelected
                      ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {isFirst ? <Trophy className="h-4 w-4" /> : `#${i + 1}`}
                  </div>
                  <EntityLogo src={crLogoUrl(r.nombre)} name={r.nombre} />
                  <div className="min-w-[150px] flex-1">
                    <div className="text-sm font-semibold">{r.nombre}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TNA</div>
                    <div className="text-sm font-bold text-primary">{r.tna.toFixed(2)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TEA</div>
                    <div className="text-sm font-semibold">{r.tea.toFixed(1)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{days === 365 ? "1 año" : `${days} días`}</div>
                    <div className="text-sm font-bold text-success">+ARS {gain.toLocaleString("es-AR")}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Los fondos money market invierten en instrumentos de corto plazo (plazos fijos, cauciones, letras). La TNA mostrada corresponde al rendimiento de los últimos 7 días anualizado y puede variar diariamente. Invertir en FCI implica riesgos. Verificá siempre las condiciones con cada sociedad gerente antes de invertir. Primus no recibe comisión de ninguna entidad.
            </span>
          </div>
        </Card>
      )}

      {/* ── TAB: Consolidado ── */}
      {tab === "all" && (
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <div>
            <h3 className="text-base font-semibold">Ranking Consolidado</h3>
            <p className="text-xs text-muted-foreground">
              Plazo Fijo · Cuentas Remuneradas · FCI · Fuentes: BCRA, Régimen de
              Transparencia y ArgentinaDatos (actualización automática)
            </p>
          </div>

          <div className="mt-5 space-y-2.5">
            {consolidado.map((r, i) => {
              const gain       = r.tipo === "Plazo Fijo" ? gainPf(amount, r.tna, days) : gainCr(amount, r.tea, days);
              const isFirst    = i === 0;
              const isSelected = i === selectedAllIdx;
              const tipoBadgeClass =
                r.tipo === "Plazo Fijo"        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                r.tipo === "Cuenta Remunerada" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" :
                                                  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";
              const expKey = `all-${r.tipo}-${r.nombre}`;
              return (
                <div key={`${r.nombre}-${r.tipo}-${i}`} className="space-y-1.5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedAllIdx(i)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedAllIdx(i); } }}
                  className={`w-full cursor-pointer text-left flex flex-wrap items-center gap-3 rounded-xl border p-3.5 transition ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                    isSelected ? "bg-[image:var(--gradient-primary)] text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {isFirst ? <Trophy className="h-4 w-4" /> : `#${i + 1}`}
                  </div>
                  <EntityLogo src={r.logoSrc} name={r.nombre} />
                  <div className="min-w-[150px] flex-1">
                    <div className="text-sm font-semibold">{r.nombre}</div>
                    <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${tipoBadgeClass}`}>
                      {r.tipo}
                    </span>
                    {r.variantes && (
                      <VerMasOfertas
                        count={r.variantes.length}
                        abierta={expandida === expKey}
                        onToggle={() => toggleExpandida(expKey)}
                      />
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TNA</div>
                    <div className="text-sm font-bold text-primary">{r.tna.toFixed(2)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TEA</div>
                    <div className="text-sm font-semibold">{r.tea.toFixed(1)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{days === 365 ? "1 año" : `${days} días`}</div>
                    <div className="text-sm font-bold text-success">+ARS {gain.toLocaleString("es-AR")}</div>
                  </div>
                </div>
                {r.variantes && expandida === expKey && (
                  <VariantesList variantes={r.variantes} amount={amount} days={days} />
                )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Vista unificada de las tres categorías de inversión ordenadas por TEA. Los plazos fijos usan interés simple; las cuentas remuneradas y FCI usan capitalización diaria. Esta información es exclusivamente informativa. Primus no recibe comisión de ninguna entidad.
            </span>
          </div>
        </Card>
      )}

    </div>
  );
}

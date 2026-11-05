import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Landmark, Award, Info, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLoanProducts } from "@/lib/api/loans.functions";
import type { LoanProduct } from "@/lib/api/loans-data";
import { getUserAccounts } from "@/lib/api/accounts.functions";
import { getObligations } from "@/lib/api/obligations.functions";
import { getTipoCambio } from "@/lib/api/fx.functions";

export const Route = createFileRoute("/_app/loans")({
  loader: async () => {
    const [{ productos, fuente }, accounts, obligations, tipoCambio] = await Promise.all([
      getLoanProducts(),
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
    const insolvencia = Math.max(0, Math.round(totalVencidas - totalArs));
    return { productos, fuente, defaultAmount: insolvencia };
  },
  component: Loans,
});

// ─── Logo helpers ─────────────────────────────────────────────────────────────

const LOCAL_LOGOS: Record<string, string> = {
  "Banco Supervielle": "/logos/supervielle.png",
  "Ualá":              "/logos/uala.png",
  "Banco Provincia":   "/logos/provincia.png",
  "Banco Ciudad":      "/logos/ciudad.png",
  "Banco Galicia":     "/logos/galicia.png",
  "Banco Macro":       "/logos/macro.png",
  "Banco Patagonia":   "/logos/patagonia.png",
  "Bancor":            "/logos/bancor.png",
  "Brubank":           "/logos/brubank.png",
};

const FAVICON_DOMAINS: Record<string, string> = {
  "Banco Nación":      "bna.com.ar",
  "Banco Provincia":   "bancoprovincia.com.ar",
  "Banco Ciudad":      "bancociudad.com.ar",
  "Santander":         "santander.com.ar",
  "BBVA":              "bbva.com.ar",
  "Naranja X":         "naranjax.com",
  "Mercado Pago":      "mercadopago.com.ar",
};

// Prioridad: logo local → logo publicado por el BCRA (el mismo que usa Opciones de
// Inversión) → favicon del sitio de la entidad (solo para los datos de respaldo)
function loanLogoUrl(entidad: string, bcraLogo?: string): string | null {
  if (LOCAL_LOGOS[entidad]) return LOCAL_LOGOS[entidad];
  if (bcraLogo) return bcraLogo;
  const d = FAVICON_DOMAINS[entidad];
  return d ? `https://www.google.com/s2/favicons?domain=${d}&sz=64` : null;
}

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
      <img src={src} alt="" className="h-full w-full object-contain" onError={() => setErr(true)} />
    </div>
  );
}

// Etiqueta para distinguir los préstamos UVA (su CFT es una tasa sobre la inflación)
function UvaBadge() {
  return (
    <span
      title="Préstamo UVA: el capital se ajusta por inflación (CER)"
      className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning"
    >
      UVA
    </span>
  );
}

// ─── Cálculo cuota (sistema francés) ─────────────────────────────────────────

// El CFT es una tasa efectiva anual: la tasa mensual equivalente es
// (1 + CFT)^(1/12) − 1, no CFT / 12 (eso la trataría como nominal)
function cuotaMensual(cft: number, monto: number, meses: number): number {
  const i = Math.pow(1 + cft / 100, 1 / 12) - 1;
  if (i === 0) return Math.round(monto / meses);
  return Math.round((monto * i) / (1 - Math.pow(1 + i, -meses)));
}

function fmtArs(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function fmtFecha(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function fmtPlazo(p: number): string {
  return p % 12 === 0 ? `${p / 12}a` : `${p}m`;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLAZOS = [6, 12, 24, 36, 48, 60, 72];
const PAGE_SIZE = 20;
const TODOS = "Todos los beneficiarios";

type EntityGroup = { entidad: string; ofertas: LoanProduct[] };

// ─── Componente ───────────────────────────────────────────────────────────────

function Loans() {
  const { productos, fuente, defaultAmount } = Route.useLoaderData();
  const [amount, setAmount]           = useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("primus_insolvencia");
      if (stored !== null) return Number(stored);
    }
    return defaultAmount;
  });
  const [inputStr, setInputStr]       = useState(() => fmtArs(amount));
  const amountRef                     = useRef<HTMLInputElement>(null);
  const [plazo, setPlazo]             = useState(6);

  // Ranking
  const [visibles, setVisibles]       = useState(PAGE_SIZE);
  const [expandida, setExpandida]     = useState<string | null>(null);
  const [selectedId, setSelectedId]   = useState<string | null>(null);

  // Ofertas en pesos y UVA (ya vienen ordenadas por CFT), agrupadas en una fila
  // por entidad ordenada por su mejor CFT
  const grupos = useMemo<EntityGroup[]>(() => {
    const map = new Map<string, LoanProduct[]>();
    for (const p of productos) {
      if (!map.has(p.entidad)) map.set(p.entidad, []);
      map.get(p.entidad)!.push(p);
    }
    return [...map.entries()].map(([entidad, ofertas]) => ({ entidad, ofertas }));
  }, [productos]);

  const allOfertas = grupos.flatMap((g) => g.ofertas);
  const selected   = allOfertas.find((o) => o.id === selectedId) ?? grupos[0]?.ofertas[0];
  const selAvailable = selected && plazo <= selected.plazoMax;
  const selCuota     = selAvailable ? cuotaMensual(selected.cft, amount, plazo) : null;
  const selTotal     = selCuota != null ? selCuota * plazo : null;
  const selIntereses = selTotal != null ? selTotal - amount : null;

  const best      = grupos[0]?.ofertas[0];
  const bestCuota = best ? cuotaMensual(best.cft, amount, plazo) : 0;

  const detalle = (o: LoanProduct) =>
    [
      o.producto,
      o.condiciones,
      o.perfil && o.perfil !== TODOS ? `Solo ${o.perfil.charAt(0).toLowerCase()}${o.perfil.slice(1)}` : null,
      `hasta ARS ${fmtArs(o.montoMax)}`,
      `${o.plazoMax} meses`,
      o.fecha && `informado ${fmtFecha(o.fecha)}`,
    ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">

      {/* ── Calculadora ── */}
      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Landmark className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">Calculadora de Cuotas</h3>
            <p className="text-xs text-muted-foreground">
              Seleccioná una opción del ranking para calcular tu cuota mensual.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 md:items-end">
            <div>
              <Label htmlFor="amount">Monto a solicitar (ARS)</Label>
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
                {PLAZOS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlazo(p)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${
                      plazo === p
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {fmtPlazo(p)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selected && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[image:var(--gradient-primary)] p-4 text-primary-foreground shadow-[var(--shadow-glow)]">
                <div className="text-xs opacity-90">
                  {selected.entidad} · {selected.tipo === "uva" ? "Cuota inicial (UVA)" : "Cuota mensual"}
                </div>
                <div className="mt-1 text-2xl font-bold tracking-tight">
                  {selCuota != null ? `ARS ${fmtArs(selCuota)}` : "Plazo no disponible"}
                </div>
                <div className="text-xs opacity-90">CFT {selected.cft.toFixed(1)}% · TNA {selected.tna.toFixed(1)}%</div>
              </div>
              {selTotal != null && (
                <>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total a pagar</div>
                    <div className="mt-1 text-xl font-bold">ARS {fmtArs(selTotal)}</div>
                    <div className="text-xs text-muted-foreground">en {plazo} cuotas</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Costo financiero</div>
                    <div className="mt-1 text-xl font-bold text-destructive">ARS {fmtArs(selIntereses!)}</div>
                    <div className="text-xs text-muted-foreground">sobre ARS {fmtArs(amount)}</div>
                  </div>
                </>
              )}
            </div>
          )}
          {selected && (
            <p className="text-xs text-muted-foreground">
              {selected.tipo === "uva"
                ? "En los préstamos UVA el capital se ajusta por inflación (CER): la cuota calculada es la inicial y varía mes a mes."
                : "En los préstamos en pesos a tasa fija la cuota se mantiene igual durante todo el plazo: la cuota calculada es la que pagás cada mes."}
            </p>
          )}
        </div>
      </Card>

      {/* ── Ranking ── */}
      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div>
          <h3 className="text-base font-semibold">Ranking Oferta Crediticia</h3>
          <p className="text-xs text-muted-foreground">
            Préstamos personales de libre destino en pesos y UVA ·{" "}
            {fuente === "BCRA"
              ? "Fuente: BCRA, Régimen de Transparencia (actualización automática)"
              : "Datos de respaldo (junio 2026): el BCRA no respondió"}
          </p>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {grupos.length} {grupos.length === 1 ? "entidad" : "entidades"} · {allOfertas.length}{" "}
          {allOfertas.length === 1 ? "oferta" : "ofertas"}
        </p>

        <div className="mt-3 space-y-2.5">
          {grupos.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No hay ofertas informadas al BCRA en los últimos 90 días.
            </div>
          )}

          {grupos.slice(0, visibles).map((g, i) => {
            const r          = g.ofertas[0];
            const available  = plazo <= r.plazoMax;
            const c          = available ? cuotaMensual(r.cft, amount, plazo) : null;
            const diff       = c != null ? c * plazo - bestCuota * plazo : null;
            const isFirst    = i === 0;
            const isSelected = selected?.entidad === g.entidad;
            const abierta    = expandida === g.entidad;
            const otras      = g.ofertas.length - 1;
            return (
              <div key={g.entidad} className="space-y-1.5">
                <div
                  role="button"
                  tabIndex={available ? 0 : -1}
                  onClick={() => available && setSelectedId(r.id)}
                  onKeyDown={(e) => { if (available && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSelectedId(r.id); } }}
                  aria-disabled={!available}
                  className={`flex w-full flex-wrap items-center gap-3 rounded-xl border p-3.5 text-left transition ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : available
                        ? "cursor-pointer border-border bg-card hover:border-primary/40"
                        : "cursor-not-allowed border-border bg-muted/30 opacity-40"
                  }`}
                >
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                    isSelected
                      ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {isFirst ? <Award className="h-4 w-4" /> : `#${i + 1}`}
                  </div>
                  <EntityLogo src={loanLogoUrl(g.entidad, r.logo)} name={g.entidad} />
                  <div className="min-w-[150px] flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      {g.entidad}
                      {r.tipo === "uva" && <UvaBadge />}
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{detalle(r)}</div>
                    {otras > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setExpandida(abierta ? null : g.entidad); }}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <ChevronDown className={`h-3 w-3 transition ${abierta ? "rotate-180" : ""}`} />
                        {abierta ? "Ocultar" : "Ver"} {otras} {otras === 1 ? "oferta más" : "ofertas más"}
                      </button>
                    )}
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TNA</div>
                      <div className="text-sm font-bold">{r.tna.toFixed(1)}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CFT</div>
                      <div className={`text-sm font-bold ${isFirst ? "text-success" : ""}`}>{r.cft.toFixed(1)}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cuota</div>
                      <div className="text-sm font-bold">{c != null ? `ARS ${fmtArs(c)}` : "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">vs. mejor</div>
                      <div className={`text-sm font-bold ${isFirst ? "text-success" : "text-destructive"}`}>
                        {!available ? "Plazo no disponible" : isFirst ? "—" : `+ARS ${fmtArs(diff!)}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Otras ofertas de la misma entidad */}
                {abierta && (
                  <div className="ml-6 space-y-1.5 border-l-2 border-border pl-3">
                    {g.ofertas.slice(1).map((o) => {
                      const oAvail = plazo <= o.plazoMax;
                      const oc     = oAvail ? cuotaMensual(o.cft, amount, plazo) : null;
                      const oSel   = selected?.id === o.id;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          disabled={!oAvail}
                          onClick={() => setSelectedId(o.id)}
                          className={`flex w-full flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                            oSel
                              ? "border-primary bg-primary/5"
                              : oAvail
                                ? "border-border bg-card hover:border-primary/40"
                                : "cursor-not-allowed border-border bg-muted/30 opacity-40"
                          }`}
                        >
                          <div className="flex min-w-[150px] flex-1 items-center gap-1.5 text-[11px] text-muted-foreground">
                            {o.tipo === "uva" && <UvaBadge />}
                            {detalle(o)}
                          </div>
                          <div className="ml-auto flex items-center gap-3">
                            <div className="text-xs font-semibold">TNA {o.tna.toFixed(1)}%</div>
                            <div className="text-xs font-semibold">CFT {o.cft.toFixed(1)}%</div>
                            <div className="w-28 text-right text-xs font-semibold">
                              {oc != null ? `ARS ${fmtArs(oc)}` : "Plazo no disp."}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {grupos.length > visibles && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" className="rounded-xl" onClick={() => setVisibles((v) => v + PAGE_SIZE)}>
              Ver más ({grupos.length - visibles} {grupos.length - visibles === 1 ? "entidad restante" : "entidades restantes"})
            </Button>
          </div>
        )}

        <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            Esta información tiene carácter exclusivamente informativo y no constituye asesoramiento financiero. Las tasas y CFT provienen del Régimen de Transparencia del BCRA; se muestran los préstamos personales de libre destino de bancos y compañías financieras informados en los últimos 90 días y pueden no reflejar las condiciones vigentes. Algunas ofertas requieren un perfil específico (por ejemplo, cobrar el sueldo en la entidad). Verificá siempre directamente con cada entidad antes de contratar. Primus no recibe comisión de ninguna entidad.
          </span>
        </div>
      </Card>
    </div>
  );
}

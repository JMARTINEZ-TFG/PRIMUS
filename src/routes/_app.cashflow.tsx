import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_app/cashflow")({
  component: CashFlow,
});

type Range = "7" | "14" | "30";

const series: Record<Range, { d: string; v: number }[]> = {
  "7": [
    { d: "L", v: 2847 }, { d: "M", v: 2700 }, { d: "X", v: 2520 },
    { d: "J", v: 2400 }, { d: "V", v: 2210 }, { d: "S", v: 2480 }, { d: "D", v: 2640 },
  ],
  "14": Array.from({ length: 14 }, (_, i) => ({ d: `${i + 1}`, v: 2800 - i * 80 + (i > 8 ? i * 60 : 0) })),
  "30": Array.from({ length: 30 }, (_, i) => ({
    d: `${i + 1}`,
    v: 2800 + Math.sin(i / 3) * 350 - (i > 15 && i < 22 ? 600 : 0),
  })),
};

function CashFlow() {
  const [range, setRange] = useState<Range>("30");
  const data = series[range];
  const min = Math.min(...data.map((d) => d.v));
  const max = Math.max(...data.map((d) => d.v));
  const deficit = data.filter((d) => d.v < 2200);
  const deficitStart = deficit.length ? deficit[0].d : null;
  const deficitEnd = deficit.length ? deficit[deficit.length - 1].d : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Pico Máximo" value={`ARS ${max.toLocaleString("es-AR")}k`} hint="Liquidez proyectada" icon={TrendingUp} accent="success" />
        <MetricCard label="Punto Mínimo" value={`ARS ${min.toLocaleString("es-AR")}k`} hint={deficitStart ? `Día ${deficitStart}` : "Sin riesgo"} icon={TrendingDown} accent={min < 2200 ? "destructive" : "primary"} />
        <MetricCard label="Días en Déficit" value={`${deficit.length}`} hint="Saldo bajo umbral mínimo" icon={AlertTriangle} accent={deficit.length ? "warning" : "success"} />
      </div>

      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Proyección Predictiva de Liquidez</h3>
            <p className="text-xs text-muted-foreground">Basada en ingresos recurrentes, vencimientos OCR y patrón de gasto.</p>
          </div>
          <div className="inline-flex rounded-xl bg-muted p-1 text-xs">
            {(["7", "14", "30"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {r} días
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 h-80">
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
              <defs>
                <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.55 0.22 255)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="oklch(0.55 0.22 255)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" vertical={false} />
              <XAxis dataKey="d" stroke="oklch(0.55 0.03 255)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.55 0.03 255)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}k`} />
              {deficitStart && deficitEnd && (
                <ReferenceArea x1={deficitStart} x2={deficitEnd} fill="oklch(0.65 0.21 25)" fillOpacity={0.08} />
              )}
              <ReferenceArea y1={3000} y2={4000} fill="oklch(0.62 0.17 155)" fillOpacity={0.05} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.92 0.01 250)" }}
                formatter={(v: number) => [`ARS ${v}k`, "Liquidez"]}
              />
              <Area dataKey="v" stroke="oklch(0.55 0.22 255)" strokeWidth={2.5} fill="url(#cf)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-success/40" /> Superávit (excedente de liquidez)</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-destructive/30" /> Déficit (riesgo de insolvencia)</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-primary" /> Saldo proyectado</span>
        </div>
      </Card>

      {deficit.length > 0 && (
        <Card className="rounded-2xl border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold">Alerta de descalce proyectado</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Entre los días {deficitStart} y {deficitEnd} tu liquidez baja del umbral seguro. Primus te sugiere comparar líneas de crédito para anticiparte.
              </p>
              <div className="mt-3 flex gap-2">
                <Badge className="rounded-full bg-primary/10 text-primary">Sugerencia: revisar Comparador de Financiaciones</Badge>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

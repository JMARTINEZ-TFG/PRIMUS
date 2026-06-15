import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Sparkles, Trophy } from "lucide-react";

export const Route = createFileRoute("/_app/investments")({
  component: Investments,
});

type Opt = { entidad: string; tipo: string; tea: number; plazo: number };

const options: Opt[] = [
  { entidad: "Banco Macro", tipo: "Plazo Fijo UVA", tea: 142.5, plazo: 90 },
  { entidad: "Cocos Capital", tipo: "FCI Renta Fija", tea: 128.4, plazo: 30 },
  { entidad: "Mercado Pago", tipo: "Fondo Money Market", tea: 118.2, plazo: 1 },
  { entidad: "Balanz", tipo: "FCI Renta Mixta", tea: 115.7, plazo: 60 },
  { entidad: "Banco Nación", tipo: "Plazo Fijo Tradicional", tea: 109.5, plazo: 30 },
  { entidad: "Ualá", tipo: "Cuenta Remunerada", tea: 92.0, plazo: 1 },
];

function Investments() {
  const [amount, setAmount] = useState(420000);
  const ranked = useMemo(() => [...options].sort((a, b) => b.tea - a.tea), []);
  const best = ranked[0];
  const calc = (tea: number, dias: number) => Math.round((amount * (tea / 100) * dias) / 365);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">Simulador de Fondos Ociosos</h3>
            <p className="text-xs text-muted-foreground">Primus detectó <strong className="text-foreground">ARS 420.000</strong> en cuentas no remuneradas.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Label htmlFor="amount">Monto a colocar (ARS)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="mt-1.5 h-12 rounded-xl text-lg font-semibold"
            />
          </div>
          <div className="rounded-xl bg-[image:var(--gradient-primary)] p-4 text-primary-foreground shadow-[var(--shadow-glow)]">
            <div className="text-xs opacity-90">Mejor opción · {best.entidad}</div>
            <div className="mt-1 text-2xl font-bold tracking-tight">
              + ARS {calc(best.tea, best.plazo).toLocaleString("es-AR")}
            </div>
            <div className="text-xs opacity-90">Rendimiento estimado a {best.plazo} días</div>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Ranking de Alternativas</h3>
            <p className="text-xs text-muted-foreground">Ordenado por rendimiento real (TEA)</p>
          </div>
          <Badge variant="secondary" className="rounded-full">Datos del mercado · 30 nov</Badge>
        </div>

        <div className="mt-5 space-y-3">
          {ranked.map((o, i) => {
            const gain = calc(o.tea, o.plazo);
            const isBest = i === 0;
            return (
              <div
                key={o.entidad}
                className={`flex flex-wrap items-center gap-4 rounded-xl border p-4 transition hover:border-primary/40 ${isBest ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
              >
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${isBest ? "bg-[image:var(--gradient-primary)] text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {isBest ? <Trophy className="h-4 w-4" /> : `#${i + 1}`}
                </div>
                <div className="min-w-[180px] flex-1">
                  <div className="text-sm font-semibold">{o.entidad}</div>
                  <div className="text-xs text-muted-foreground">{o.tipo}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">TEA</div>
                  <div className="text-sm font-bold text-primary">{o.tea.toFixed(1)}%</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Plazo</div>
                  <div className="text-sm font-semibold">{o.plazo} d</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Ganancia est.</div>
                  <div className="text-sm font-bold text-success">+ARS {gain.toLocaleString("es-AR")}</div>
                </div>
                <button className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-primary/40 hover:text-primary">
                  Simular
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          <TrendingUp className="mt-0.5 h-4 w-4 text-primary" />
          Las tasas son referenciales y se actualizan diariamente. Primus elimina la asimetría de información — no recibimos comisión de ninguna entidad.
        </div>
      </Card>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Landmark, ShieldCheck, Award } from "lucide-react";

export const Route = createFileRoute("/_app/loans")({
  component: Loans,
});

type Loan = { entidad: string; tea: number; cft: number; plazos: number[] };

const loans: Loan[] = [
  { entidad: "Banco Nación", tea: 78.5, cft: 92.4, plazos: [12, 24, 36] },
  { entidad: "Banco Provincia", tea: 84.2, cft: 101.7, plazos: [12, 24] },
  { entidad: "Banco Galicia", tea: 91.3, cft: 112.5, plazos: [6, 12, 24] },
  { entidad: "Naranja X", tea: 105.7, cft: 138.2, plazos: [3, 6, 12] },
  { entidad: "Mercado Crédito", tea: 124.0, cft: 168.4, plazos: [3, 6, 9] },
  { entidad: "Ualá Crédito", tea: 142.8, cft: 195.6, plazos: [3, 6] },
];

function Loans() {
  const [amount, setAmount] = useState(500000);
  const [plazo, setPlazo] = useState(12);
  const ranked = useMemo(() => [...loans].sort((a, b) => a.cft - b.cft), []);
  const best = ranked[0];

  const cuota = (cft: number, n: number) => {
    const i = cft / 100 / 12;
    return Math.round((amount * i) / (1 - Math.pow(1 + i, -n)));
  };
  const total = (cft: number, n: number) => cuota(cft, n) * n;
  const bestTotal = total(best.cft, plazo);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Landmark className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">Calculadora de Cuotas</h3>
            <p className="text-xs text-muted-foreground">Compará el costo financiero real entre todas las alternativas del mercado.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="m">Monto (ARS)</Label>
            <Input id="m" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="mt-1.5 h-12 rounded-xl font-semibold" />
          </div>
          <div>
            <Label>Plazo (meses)</Label>
            <div className="mt-1.5 inline-flex w-full rounded-xl bg-muted p-1">
              {[6, 12, 24, 36].map((p) => (
                <button
                  key={p}
                  onClick={() => setPlazo(p)}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition ${plazo === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-[image:var(--gradient-primary)] p-4 text-primary-foreground shadow-[var(--shadow-glow)]">
            <div className="text-xs opacity-90">Mejor cuota · {best.entidad}</div>
            <div className="mt-1 text-2xl font-bold tracking-tight">
              ARS {cuota(best.cft, plazo).toLocaleString("es-AR")}
            </div>
            <div className="text-xs opacity-90">x {plazo} meses · CFT {best.cft}%</div>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Ranking por Costo Financiero Total</h3>
            <p className="text-xs text-muted-foreground">De menor a mayor CFT (incluye impuestos)</p>
          </div>
          <Badge variant="secondary" className="rounded-full">Soporte ante descalces de caja</Badge>
        </div>

        <div className="mt-5 space-y-3">
          {ranked.map((l, i) => {
            const c = cuota(l.cft, plazo);
            const t = total(l.cft, plazo);
            const diff = t - bestTotal;
            const isBest = i === 0;
            return (
              <div
                key={l.entidad}
                className={`grid grid-cols-2 gap-3 rounded-xl border p-4 md:grid-cols-6 md:items-center md:gap-4 ${isBest ? "border-success/40 bg-success/5" : "border-border bg-card"}`}
              >
                <div className="col-span-2 flex items-center gap-3 md:col-span-2">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${isBest ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                    {isBest ? <Award className="h-4 w-4" /> : `#${i + 1}`}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{l.entidad}</div>
                    <div className="text-xs text-muted-foreground">Plazos: {l.plazos.join(" · ")} meses</div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TEA</div>
                  <div className="text-sm font-bold">{l.tea}%</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CFT</div>
                  <div className={`text-sm font-bold ${isBest ? "text-success" : "text-foreground"}`}>{l.cft}%</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cuota</div>
                  <div className="text-sm font-bold">ARS {c.toLocaleString("es-AR")}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Diferencia vs mejor</div>
                  <div className={`text-sm font-bold ${isBest ? "text-success" : "text-destructive"}`}>
                    {isBest ? "—" : `+ ARS ${diff.toLocaleString("es-AR")}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
          CFT calculado con impuestos y comisiones publicadas. Tomar la peor opción te costaría hasta ARS {(total(ranked[ranked.length - 1].cft, plazo) - bestTotal).toLocaleString("es-AR")} más.
        </div>
      </Card>
    </div>
  );
}

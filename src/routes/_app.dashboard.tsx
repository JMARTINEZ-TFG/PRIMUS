import { createFileRoute } from "@tanstack/react-router";
import {
  Wallet,
  CalendarClock,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard } from "@/components/MetricCard";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const sparkline = [
  { d: "L", v: 2400 }, { d: "M", v: 2520 }, { d: "X", v: 2480 },
  { d: "J", v: 2680 }, { d: "V", v: 2720 }, { d: "S", v: 2810 }, { d: "D", v: 2847 },
];

const upcoming = [
  { emisor: "EPEC", fecha: "03 Dic", monto: "ARS 24.580", estado: "Próximo" },
  { emisor: "Ecogas", fecha: "07 Dic", monto: "ARS 12.300", estado: "Próximo" },
  { emisor: "Visa Galicia", fecha: "10 Dic", monto: "ARS 187.420", estado: "Urgente" },
];

const activity = [
  { tipo: "in", desc: "Transferencia recibida — Cliente Acme", fecha: "Hoy 14:32", monto: "+ ARS 145.000" },
  { tipo: "out", desc: "Pago EPEC — Octubre", fecha: "Ayer 09:15", monto: "- ARS 22.140" },
  { tipo: "in", desc: "Acreditación MercadoPago", fecha: "28 Nov", monto: "+ ARS 38.200" },
  { tipo: "out", desc: "Spotify Family", fecha: "27 Nov", monto: "- ARS 4.290" },
  { tipo: "out", desc: "Supermercado Disco", fecha: "26 Nov", monto: "- ARS 56.730" },
];

function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Saldo Consolidado" value="ARS 2.847.320" hint="6 cuentas · USD 1.842" trend="4.2%" icon={Wallet} accent="primary" />
        <MetricCard label="Próximos Vencimientos" value="ARS 224.300" hint="3 pendientes · 12 días" trend="1.1%" trendDir="down" icon={CalendarClock} accent="warning" />
        <MetricCard label="Fondos Ociosos" value="ARS 420.000" hint="Sugerimos colocar" trend="rendimiento +ARS 14.7k" icon={Activity} accent="success" />
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Situación Financiera</span>
            <ShieldCheck className="h-4 w-4 text-success" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
            </span>
            <span className="text-xl font-bold tracking-tight">SALUDABLE</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="h-1.5 rounded-full bg-success" />
            <div className="h-1.5 rounded-full bg-success" />
            <div className="h-1.5 rounded-full bg-muted" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Tu ratio ingreso/egreso es 1.84×</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)] xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Evolución Saldo Consolidado</h3>
              <p className="text-xs text-muted-foreground">Últimos 7 días</p>
            </div>
            <Badge variant="secondary" className="rounded-full">+4.2% sem.</Badge>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <AreaChart data={sparkline} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.55 0.22 255)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(0.55 0.22 255)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="d" stroke="oklch(0.55 0.03 255)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.55 0.03 255)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.92 0.01 250)" }} />
                <Area dataKey="v" stroke="oklch(0.55 0.22 255)" strokeWidth={2.5} fill="url(#ga)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <h3 className="text-base font-semibold">Próximos Vencimientos</h3>
          <p className="text-xs text-muted-foreground">Extraídos vía OCR</p>
          <div className="mt-4 space-y-3">
            {upcoming.map((u) => (
              <div key={u.emisor} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
                <div>
                  <div className="text-sm font-semibold">{u.emisor}</div>
                  <div className="text-xs text-muted-foreground">{u.fecha}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{u.monto}</div>
                  <Badge variant={u.estado === "Urgente" ? "destructive" : "secondary"} className="mt-0.5 rounded-full text-[10px]">
                    {u.estado}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Actividad Reciente</h3>
            <p className="text-xs text-muted-foreground">Movimientos consolidados de todas tus cuentas</p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Descripción</TableHead>
                <TableHead className="hidden md:table-cell">Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="flex items-center gap-3">
                    <div className={`grid h-8 w-8 place-items-center rounded-lg ${a.tipo === "in" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {a.tipo === "in" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <span className="font-medium">{a.desc}</span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{a.fecha}</TableCell>
                  <TableCell className={`text-right font-semibold ${a.tipo === "in" ? "text-success" : "text-foreground"}`}>{a.monto}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

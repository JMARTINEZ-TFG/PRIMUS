import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Wifi, WifiOff, ShieldCheck, Building2, Smartphone, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/accounts")({
  component: Accounts,
});

type Acc = {
  name: string;
  type: string;
  saldo: string;
  status: "ok" | "warn";
  cvu?: string;
  icon: typeof Building2;
  brand: string;
};

const initial: Acc[] = [
  { name: "Banco Galicia", type: "Caja de Ahorros", saldo: "ARS 845.230", status: "ok", cvu: "•••• 4521", icon: Building2, brand: "bg-orange-100 text-orange-600" },
  { name: "Banco Santander", type: "Cuenta Corriente", saldo: "ARS 1.240.800", status: "ok", cvu: "•••• 8912", icon: Building2, brand: "bg-red-100 text-red-600" },
  { name: "Mercado Pago", type: "CVU", saldo: "ARS 320.450", status: "ok", cvu: "•••• 2210", icon: Smartphone, brand: "bg-cyan-100 text-cyan-700" },
  { name: "Ualá", type: "CVU", saldo: "ARS 142.090", status: "warn", cvu: "•••• 7733", icon: Smartphone, brand: "bg-violet-100 text-violet-600" },
  { name: "BBVA USD", type: "Caja de Ahorros USD", saldo: "USD 1.842", status: "ok", cvu: "•••• 1107", icon: Building2, brand: "bg-blue-100 text-blue-600" },
  { name: "Visa Galicia", type: "Tarjeta Crédito", saldo: "ARS -187.420", status: "ok", cvu: "•••• 0024", icon: CreditCard, brand: "bg-indigo-100 text-indigo-600" },
];

function Accounts() {
  const [open, setOpen] = useState(false);
  const handleLink = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    toast.success("Cuenta vinculada vía Open Finance.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{initial.length} entidades sincronizadas · última actualización hace 2 minutos</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-xl shadow-[var(--shadow-glow)]">
          <Plus className="mr-1 h-4 w-4" /> Vincular Nueva Cuenta
        </Button>
      </div>

      {initial.some((a) => a.status === "warn") && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
          <WifiOff className="mt-0.5 h-5 w-5 text-warning" />
          <div className="flex-1">
            <div className="text-sm font-semibold">Conexión intermitente con Ualá</div>
            <p className="text-xs text-muted-foreground">Estamos manteniendo el último saldo conocido. Reintentaremos automáticamente en 5 min.</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl">Reintentar</Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {initial.map((a) => (
          <Card key={a.name} className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-primary/30">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`grid h-11 w-11 place-items-center rounded-xl ${a.brand}`}>
                  <a.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.type} · {a.cvu}</div>
                </div>
              </div>
              {a.status === "ok" ? (
                <Badge variant="secondary" className="gap-1 rounded-full bg-success/10 text-success">
                  <Wifi className="h-3 w-3" /> Activa
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 rounded-full bg-warning/15 text-warning">
                  <WifiOff className="h-3 w-3" /> Caché
                </Badge>
              )}
            </div>
            <div className="mt-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Saldo actual</div>
              <div className={`mt-1 text-2xl font-bold tracking-tight ${a.saldo.includes("-") ? "text-destructive" : ""}`}>{a.saldo}</div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span>Sincronizado hace 2 min</span>
              <button className="font-medium text-primary hover:underline">Ver movimientos</button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular Nueva Cuenta</DialogTitle>
            <DialogDescription>
              Conexión cifrada vía Open Finance. Primus nunca almacena tus credenciales.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLink} className="space-y-3">
            <div>
              <Label>Entidad</Label>
              <select className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option>Banco Galicia</option><option>BBVA</option><option>Macro</option><option>Brubank</option><option>Naranja X</option>
              </select>
            </div>
            <div>
              <Label>Usuario / DNI</Label>
              <Input className="mt-1.5 h-10 rounded-xl" placeholder="20.123.456" />
            </div>
            <div>
              <Label>Clave de homebanking</Label>
              <Input type="password" className="mt-1.5 h-10 rounded-xl" placeholder="••••••••" />
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
              Conexión TLS 1.3 · Token OAuth de solo lectura · Auditable.
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="rounded-xl">Vincular</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

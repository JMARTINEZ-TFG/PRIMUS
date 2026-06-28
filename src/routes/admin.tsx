import { createFileRoute, useRouter, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, UserX, Clock, CheckCircle2, LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PrimusLogo } from "@/components/PrimusLogo";
import { toast } from "sonner";
import { getAdminData, approveUnlock, logoutUser } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administración — Primus" }] }),
  loader: async () => {
    try {
      const requests = await getAdminData();
      return { requests };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: AdminPanel,
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function AdminPanel() {
  const { requests: initial } = Route.useLoaderData();
  const [requests, setRequests] = useState(initial);
  const [approving, setApproving] = useState<number | null>(null);
  const router = useRouter();

  const handleApprove = async (id_usuario: number, email: string) => {
    setApproving(id_usuario);
    try {
      await approveUnlock({ data: { id_usuario } });
      setRequests((prev) => prev.filter((r) => r.id_usuario !== id_usuario));
      toast.success(`Cuenta de ${email} desbloqueada.`);
    } catch {
      toast.error("No se pudo procesar. Intentá de nuevo.");
    } finally {
      setApproving(null);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">

        <div className="flex items-center justify-between">
          <PrimusLogo />
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Salir
          </Button>
        </div>

        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Panel de Administración</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Solicitudes de blanqueo de clave pendientes de aprobación.
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-success/60" />
              <p className="text-sm font-medium">Sin solicitudes pendientes</p>
              <p className="text-xs text-muted-foreground">No hay cuentas bloqueadas con solicitud de blanqueo.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div
                  key={r.id_usuario}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-destructive/10">
                    <UserX className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{r.email}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(r.unlock_requested_at)}
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        {r.failed_attempts} intentos fallidos
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-xl"
                    disabled={approving === r.id_usuario}
                    onClick={() => handleApprove(r.id_usuario, r.email)}
                  >
                    {approving === r.id_usuario ? "Procesando…" : "Aprobar"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}

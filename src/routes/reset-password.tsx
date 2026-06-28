import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrimusLogo } from "@/components/PrimusLogo";
import { toast } from "sonner";
import { resetPassword } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Restablecer contraseña — Primus" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const passValid =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  const matches = password === confirm;

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="mb-8"><PrimusLogo /></div>
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)] text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-destructive/10">
            <XCircle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold">Enlace inválido</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            El enlace de recuperación expiró o es incorrecto. Solicitá uno nuevo.
          </p>
          <Button asChild variant="outline" className="mt-6 w-full rounded-xl">
            <Link to="/login">Volver</Link>
          </Button>
        </div>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!passValid) return toast.error("La contraseña no cumple los requisitos.");
    if (!matches) return toast.error("Las contraseñas no coinciden.");

    setLoading(true);
    try {
      await resetPassword({ data: { token, password } });
      toast.success("Contraseña actualizada. Ya podés iniciar sesión.");
      navigate({ to: "/login" });
    } catch {
      toast.error("El enlace expiró o ya fue utilizado. Solicitá uno nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="mb-8"><PrimusLogo /></div>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]">
        <h2 className="text-xl font-bold">Restablecer contraseña</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ingresá tu nueva contraseña.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="password">Nueva contraseña</Label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 rounded-xl pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className={`mt-1 flex items-center gap-1 text-xs ${passValid ? "text-success" : touched && !passValid ? "text-destructive" : "text-muted-foreground"}`}>
              {passValid ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              Mínimo 8 caracteres (mayúscula, minúscula, número y carácter especial).
            </p>
          </div>

          <div>
            <Label htmlFor="confirm">Confirmar contraseña</Label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm"
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className={`h-11 rounded-xl pl-9 ${touched && !matches ? "border-destructive" : ""}`}
              />
            </div>
            {touched && !matches && (
              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" /> Las contraseñas no coinciden.
              </p>
            )}
          </div>

          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl shadow-[var(--shadow-glow)]">
            {loading ? "Guardando…" : "Guardar nueva contraseña"}
          </Button>
        </form>
      </div>
    </div>
  );
}

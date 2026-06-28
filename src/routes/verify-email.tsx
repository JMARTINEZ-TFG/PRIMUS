import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrimusLogo } from "@/components/PrimusLogo";
import { verifyEmail } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Verificar cuenta — Primus" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps }) => {
    if (!deps.token) return { success: false };
    try {
      await verifyEmail({ data: { token: deps.token } });
      return { success: true };
    } catch {
      return { success: false };
    }
  },
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { success } = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="mb-8">
        <PrimusLogo />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)] text-center">
        {success ? (
          <>
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-success/10">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h2 className="text-xl font-bold">¡Cuenta verificada!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu dirección de correo fue confirmada exitosamente. Ya podés iniciar sesión.
            </p>
            <Button asChild className="mt-6 w-full rounded-xl shadow-[var(--shadow-glow)]">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-destructive/10">
              <XCircle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">Enlace inválido</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              El enlace de verificación expiró o ya fue utilizado. Registrate nuevamente para recibir un nuevo enlace.
            </p>
            <Button asChild variant="outline" className="mt-6 w-full rounded-xl">
              <Link to="/login">Volver</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

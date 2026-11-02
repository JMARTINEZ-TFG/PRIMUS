import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Menu } from "lucide-react";
import { getCurrentUser } from "@/lib/api/auth.functions";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: AppLayout,
});

// short: título en celular, donde no entra el completo
const titles: Record<string, { title: string; short?: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Vista consolidada de tu salud financiera" },
  "/accounts": { title: "Cuentas Vinculadas", short: "Cuentas", subtitle: "Bancos y billeteras virtuales sincronizados" },
  "/receipts": { title: "Obligaciones", subtitle: "Control de facturas, vencimientos y pagos" },
  "/cashflow": { title: "Proyecciones de Cash Flow", short: "Cash Flow", subtitle: "Proyección de ingresos, egresos y saldo de los próximos meses" },
  "/investments": { title: "Opciones de Inversión", short: "Inversión", subtitle: "Ranking objetivo de alternativas del mercado" },
  "/loans": { title: "Opciones de Financiación", short: "Financiación", subtitle: "Crédito ordenado por CFT" },
  "/faq":   { title: "Glosario", subtitle: "Conceptos financieros explicados de forma simple" },
};

function AppLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const meta = titles[pathname] ?? { title: "Primus", subtitle: "" };

  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        {/* min-w-0: sin esto el contenido ancho (p. ej. tablas) estira la página en celular */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
            <MenuToggle />
            <div className="flex min-w-0 flex-col">
              <h1 className="truncate text-base font-semibold leading-tight">
                <span className="md:hidden">{meta.short ?? meta.title}</span>
                <span className="hidden md:inline">{meta.title}</span>
              </h1>
              <p className="hidden text-xs text-muted-foreground md:block">{meta.subtitle}</p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div
                title={user.email}
                className="grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-sm font-semibold text-primary-foreground"
              >
                {initials}
              </div>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// Botón de menú hamburguesa: abre/colapsa el menú lateral (en celular lo despliega)
function MenuToggle() {
  const { toggleSidebar } = useSidebar();
  return (
    <button onClick={toggleSidebar} title="Menú"
      className="grid h-9 w-9 place-items-center rounded-lg text-foreground transition hover:bg-muted">
      <Menu className="h-5 w-5" />
      <span className="sr-only">Abrir o cerrar el menú</span>
    </button>
  );
}

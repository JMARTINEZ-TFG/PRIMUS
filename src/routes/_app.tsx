import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const titles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Vista consolidada de tu salud financiera" },
  "/accounts": { title: "Cuentas Vinculadas", subtitle: "Bancos y billeteras virtuales sincronizados" },
  "/receipts": { title: "Comprobantes OCR", subtitle: "Ingesta documental inteligente" },
  "/cashflow": { title: "Proyecciones de Cash Flow", subtitle: "Liquidez proyectada en tiempo real" },
  "/investments": { title: "Comparador de Inversiones", subtitle: "Ranking objetivo de alternativas del mercado" },
  "/loans": { title: "Comparador de Financiaciones", subtitle: "Crédito ordenado por CFT" },
};

function AppLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const meta = titles[pathname] ?? { title: "Primus", subtitle: "" };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
            <SidebarTrigger />
            <div className="hidden flex-col md:flex">
              <h1 className="text-base font-semibold leading-tight">{meta.title}</h1>
              <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar movimientos, emisor…"
                  className="h-9 w-72 rounded-xl border-border bg-muted/40 pl-9"
                />
              </div>
              <button className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-card transition hover:bg-muted">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
              </button>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-sm font-semibold text-primary-foreground">
                MG
              </div>
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

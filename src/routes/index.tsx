import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Wallet,
  LineChart,
  ScanLine,
  TrendingUp,
  ShieldCheck,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { PrimusLogo } from "@/components/PrimusLogo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Primus — Ecosistema Autónomo de Optimización Financiera" },
      { name: "description", content: "Consolidá saldos, automatizá facturas con OCR, proyectá tu cash flow y compará inversiones y créditos del mercado en un solo tablero." },
      { property: "og:title", content: "Primus — Tu Ecosistema financiero personal" },
      { property: "og:description", content: "Transformá datos atomizados en un tablero unificado. Automatización inteligente para tus finanzas personales." },
    ],
  }),
  component: Landing,
});

const benefits = [
  {
    icon: Wallet,
    title: "Consolidación Automatizada",
    desc: "Sincronizá bancos y billeteras virtuales. Un solo saldo, todas tus disponibilidades.",
  },
  {
    icon: LineChart,
    title: "Cash Flow Inteligente",
    desc: "Proyectamos tu liquidez a 30, 90, 180 y 365 días. Anticipá déficits y superávits antes de que ocurran.",
  },
  {
    icon: ScanLine,
    title: "Carga automática de obligaciones",
    desc: "Arrastrá una factura o resumen y nuestro motor extrae emisor, monto y vencimiento sin que muevas un dedo.",
  },
  {
    icon: TrendingUp,
    title: "Comparador de Mercado",
    desc: "Ranking objetivo de Plazos Fijos, FCI y créditos. Eliminamos la asimetría de información del mercado.",
  },
];

const stats = [
  { v: "—42%", l: "tiempo en gestión financiera" },
  { v: "+18", l: "entidades integradas" },
  { v: "99.9%", l: "precisión OCR" },
  { v: "0", l: "comisiones ocultas" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-[image:var(--gradient-hero)]">
      {/* NAV */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <PrimusLogo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#producto" className="transition hover:text-foreground">Producto</a>
            <a href="#beneficios" className="transition hover:text-foreground">Beneficios</a>
            <a href="#seguridad" className="transition hover:text-foreground">Seguridad</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Ingresar</Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl">
              <Link to="/login">Empezar gratis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 md:px-6 md:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Zap className="h-3.5 w-3.5" /> Ecosistema autónomo de finanzas personales
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Tus finanzas,{" "}
              <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">
                en piloto automático.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Primus unifica tus cuentas, lee tus facturas, proyecta tu liquidez y te muestra
              objetivamente las mejores alternativas del mercado. Un solo tablero. Cero fricción.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-xl shadow-[var(--shadow-glow)]">
                <Link to="/login">
                  Registrarse gratis <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl">
                <Link to="/dashboard">Ingresar al Ecosistema</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Sin tarjeta de crédito</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Setup en 2 minutos</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Datos cifrados E2E</span>
            </div>
          </div>

          {/* MOCK DASHBOARD */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[image:var(--gradient-primary)] opacity-20 blur-3xl" />
            <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Saldo Consolidado Total</span>
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-success">SALUDABLE</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">ARS 2.847.320</span>
                <span className="text-xs font-medium text-success">+4.2%</span>
              </div>
              <div className="mt-5 h-32 w-full rounded-xl bg-gradient-to-b from-primary/15 to-transparent">
                <svg viewBox="0 0 300 100" className="h-full w-full">
                  <path d="M0,80 C40,60 60,70 90,50 C120,30 140,45 170,35 C200,25 230,40 270,15 L300,10 L300,100 L0,100 Z" fill="url(#g)" />
                  <path d="M0,80 C40,60 60,70 90,50 C120,30 140,45 170,35 C200,25 230,40 270,15 L300,10" fill="none" stroke="oklch(0.55 0.22 255)" strokeWidth="2" />
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.55 0.22 255)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="oklch(0.55 0.22 255)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                {[
                  { l: "Cuentas", v: "6", c: "text-primary" },
                  { l: "Vencen", v: "3", c: "text-warning" },
                  { l: "Ociosos", v: "ARS 420k", c: "text-success" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl border border-border bg-muted/40 p-3">
                    <div className="text-muted-foreground">{s.l}</div>
                    <div className={`mt-0.5 text-sm font-semibold ${s.c}`}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="mt-20 grid grid-cols-2 gap-6 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l}>
              <div className="text-2xl font-bold tracking-tight md:text-3xl">{s.v}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* BENEFITS */}
      <section id="beneficios" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Todo lo que necesitás, un único Ecosistema
          </h2>
          <p className="mt-3 text-muted-foreground">
            Diseñado para usuarios no especializados. Pensado como infraestructura financiera.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="group rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-primary/30"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <b.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{b.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECURITY */}
      <section id="seguridad" className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
        <div className="overflow-hidden rounded-3xl border border-border bg-[image:var(--gradient-primary)] p-8 text-primary-foreground md:p-12">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> Open Finance + cifrado E2E
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                Listo para empezar a optimizar?
              </h2>
              <p className="mt-2 max-w-xl opacity-90">
                Activá tu Ecosistema en menos de 2 minutos. Sin tarjeta. Sin compromisos.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="rounded-xl">
              <Link to="/login">
                Crear mi cuenta <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row md:px-6">
          <PrimusLogo />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Primus Labs. Ecosistema Autónomo de Optimización Financiera.
          </p>
          <div className="flex gap-5 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground">Términos</a>
            <a href="#" className="hover:text-foreground">Privacidad</a>
            <a href="#" className="hover:text-foreground">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

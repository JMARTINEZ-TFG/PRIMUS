import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { logoutUser } from "@/lib/api/auth.functions";
import {
  LayoutDashboard,
  Wallet,
  ScanLine,
  LineChart,
  TrendingUp,
  Landmark,
  HelpCircle,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { PrimusLogo } from "./PrimusLogo";

const nav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Cuentas Vinculadas", url: "/accounts", icon: Wallet },
  { title: "Obligaciones", url: "/receipts", icon: ScanLine },
  { title: "Cash Flow", url: "/cashflow", icon: LineChart },
];

const market = [
  { title: "Opciones de Inversión", url: "/investments", icon: TrendingUp },
  { title: "Opciones de Financiación", url: "/loans", icon: Landmark },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => pathname === p;

  // En celular el menú es un panel superpuesto: se cierra al elegir una opción
  // para que no quede tapando la pantalla a la que se navegó
  const { isMobile, setOpenMobile } = useSidebar();
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };

  // Igual que el botón del encabezado: cierra la sesión en el servidor antes de ir al login
  const navigate = useNavigate();
  const handleLogout = async () => {
    closeMobile();
    await logoutUser();
    toast.success("Sesión cerrada.");
    navigate({ to: "/login" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <PrimusLogo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Mi ecosistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2" onClick={closeMobile}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Mercado</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {market.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2" onClick={closeMobile}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/faq")} tooltip="Glosario financiero">
              <Link to="/faq" className="flex items-center gap-2" onClick={closeMobile}>
                <HelpCircle className="h-4 w-4" />
                <span>Glosario</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Cerrar sesión" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

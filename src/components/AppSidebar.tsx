import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  CreditCard,
  FileText,
  Calculator,
  Settings,
  User,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  SidebarRail,
} from '@/components/ui/sidebar';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { path: '/categories', label: 'Metas', icon: Target },
  { path: '/cards', label: 'Cartões', icon: CreditCard },
  { path: '/tax-report', label: 'Imposto de Renda', icon: FileText },
  { path: '/hourly-rate', label: 'Valor-Hora', icon: Calculator },
];

const AppSidebar = () => {
  const location = useLocation();
  const { user } = useAuth();

  const initials = user?.email?.slice(0, 2).toUpperCase() || 'U';
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary-foreground">P</span>
          </div>
          <span className="text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            FinMaster
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.path}
                    tooltip={item.label}
                  >
                    <Link to={item.path}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location.pathname === '/profile'}
              tooltip="Perfil"
              size="lg"
            >
              <Link to="/profile">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{displayName}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location.pathname === '/settings'}
              tooltip="Configurações"
            >
              <Link to="/settings">
                <Settings />
                <span>Configurações</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;

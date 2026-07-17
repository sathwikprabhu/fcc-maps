import { Outlet, useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useGlobal } from '../context/GlobalContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import {
  MapIcon,
  Palette,
  ImageIcon,
  Activity,
  Settings,
} from 'lucide-react';

function AppLayoutInner() {
  const location = useLocation();
  const { settings, fetchData } = useGlobal();
  const { state } = useSidebar();

  useEffect(() => {
    fetchData('default');
  }, []);

  const mainItems = [
    { title: 'Maps', path: '/', icon: MapIcon },
    { title: 'Pointer Colors', path: '/colors', icon: Palette },
    { title: 'Branding', path: '/branding', icon: ImageIcon },
  ];

  const bottomItems = [
    { title: 'Metrics', path: '/metrics', icon: Activity },
    { title: 'Settings', path: '/settings', icon: Settings },
  ];

  const isCollapsed = state === 'collapsed';
  const activeTitle = settings.appTitle || 'FCC Maps';

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== '/' && location.pathname.startsWith(path));

  return (
    <>
      <Sidebar collapsible="icon">
        {/* Header: logo + app name */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip={activeTitle}>
                <Link to="/" className="flex items-center justify-start w-full">
                  {isCollapsed ? (
                    settings.logoCollapsedUrl || settings.logoUrl ? (
                      <img src={settings.logoCollapsedUrl || settings.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
                    ) : (
                      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                        <MapIcon className="size-4 shrink-0" />
                      </div>
                    )
                  ) : (
                    settings.logoUrl ? (
                      <img src={settings.logoUrl} alt={activeTitle} className="h-8 max-w-full object-contain" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                          <MapIcon className="size-4 shrink-0" />
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-semibold">{activeTitle}</span>
                          <span className="truncate text-xs text-sidebar-foreground/60 text-left">Admin Portal</span>
                        </div>
                      </div>
                    )
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          {/* Main nav items */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive(item.path)}
                    >
                      <Link to={item.path}>
                        <item.icon className="shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Bottom nav group: Metrics + Settings, pinned above footer */}
          <SidebarGroup className="mt-auto">
            <SidebarSeparator className="mb-2" />
            <SidebarGroupContent>
              <SidebarMenu>
                {bottomItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive(item.path)}
                    >
                      <Link to={item.path}>
                        <item.icon className="shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer: non-interactive administrator identity */}
        <SidebarFooter>
          <SidebarSeparator className="mb-1" />
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-xs select-none">
              AD
            </div>
            {!isCollapsed && (
              <div className="grid flex-1 text-left text-sm leading-tight overflow-hidden">
                <span className="truncate font-medium">Administrator</span>
                <span className="truncate text-xs text-sidebar-foreground/60">Admin Portal</span>
              </div>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Main content area */}
      <SidebarInset>
        {/* Mobile header — visible only on small screens */}
        <header className="md:hidden sticky top-0 z-40 h-14 border-b flex items-center gap-3 px-4 bg-background">
          <SidebarTrigger className="-ml-1" />
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt={activeTitle} className="h-7 object-contain" />
          ) : (
            <span className="font-semibold text-sm truncate">{activeTitle}</span>
          )}
        </header>

        {/* Desktop floating sidebar toggle — takes no vertical space */}
        <div className="hidden md:block sticky top-4 z-50 h-0 overflow-visible ml-3">
          <SidebarTrigger className="shadow-md border bg-background/90 backdrop-blur-sm rounded-lg h-8 w-8 hover:bg-accent transition-colors" />
        </div>

        <div className="flex-1 p-6 overflow-auto bg-muted/20">
          <Outlet />
        </div>
      </SidebarInset>
    </>
  );
}

export default function AppLayout() {
  return (
    <SidebarProvider>
      <AppLayoutInner />
      <Toaster position="top-right" />
    </SidebarProvider>
  );
}



import { Outlet, useLocation, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useGlobal } from '../context/GlobalContext';
import { useAuthContext } from '../context/AuthContext';
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
  LogOut,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

function AppLayoutInner() {
  const location = useLocation();
  const { branding, fetchData } = useGlobal();
  const { state } = useSidebar();
  const { user } = useAuthContext();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

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
  const activeTitle = branding.appTitle || 'FCC Maps';

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
                    branding.logoCollapsedUrl || branding.logoUrl ? (
                      <img src={branding.logoCollapsedUrl || branding.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
                    ) : (
                      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                        <MapIcon className="size-4 shrink-0" />
                      </div>
                    )
                  ) : (
                    branding.logoUrl ? (
                      <img src={branding.logoUrl} alt={activeTitle} className="h-8 max-w-full object-contain" />
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

        {/* Footer: authenticated user identity + logout */}
        <SidebarFooter>
          <SidebarSeparator className="mb-1" />
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-xs select-none">
              {user
                ? user.username.slice(0, 2).toUpperCase()
                : 'AD'}
            </div>
            {!isCollapsed && (
              <div className="grid flex-1 text-left text-sm leading-tight overflow-hidden">
                <span className="truncate font-medium">
                  {user ? user.username : 'Administrator'}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {user ? 'Admin' : 'Admin Portal'}
                </span>
              </div>
            )}
            <button
              id="sidebar-logout-btn"
              aria-label="Log out"
              title="Log out"
              onClick={() => setShowLogoutDialog(true)}
              className="ml-auto flex items-center justify-center size-7 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </SidebarFooter>

        {/* Logout confirmation dialog */}
        <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Log out</DialogTitle>
              <DialogDescription>
                Are you sure you want to log out? You will be redirected to the CERN SSO logout page.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => { window.location.href = '/auth/logout'; }}
              >
                <LogOut className="size-4 mr-1.5" />
                Log Out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Sidebar>

      {/* Main content area */}
      <SidebarInset>
        {/* Mobile header — visible only on small screens */}
        <header className="md:hidden sticky top-0 z-40 h-14 border-b flex items-center gap-3 px-4 bg-background">
          <SidebarTrigger className="-ml-1" />
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={activeTitle} className="h-7 object-contain" />
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




"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Settings, UserCog, LayoutDashboard, FileUp, LogOut, Loader2 } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import Logo from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
// Removed import for SheetTitle as it's now handled within Sidebar component for mobile

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload PDF', icon: FileUp },
  { href: '/admin/persona', label: 'AI Persona', icon: UserCog, admin: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOutUser, isAdmin } = useAuth();

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  // If loading and not on login page, show a full-page loading indicator
  if (loading && pathname !== '/login') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading application...</p>
      </div>
    );
  }
  
  // If not logged in and currently on the login page, render only children (the login form)
  if (!user && pathname === '/login') {
    return <>{children}</>;
  }

  // If still loading but on the login page, let the login page handle its own loading state
  if (loading && pathname === '/login') {
     return <>{children}</>;
  }

  // If not logged in, not loading, and somehow not on login page (should be caught by useEffect), prevent layout render.
  // This ensures children of AppLayout are only rendered if user is authenticated.
  if (!user && !loading && pathname !== '/login') {
    return null; 
  }

  // At this point, user should be authenticated, or it's a scenario already handled (e.g. login page)
  // If for some reason user is null here (e.g., after logout but before redirect fully completes),
  // this check prevents rendering the main layout.
  if (!user) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-4 flex items-center justify-between">
          {/* SheetTitle for mobile is now handled directly within Sidebar component */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo className="h-8 w-auto" />
          </Link>
          <SidebarTrigger className="hidden group-data-[collapsible=icon]:flex" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.filter(item => isAdmin || !item.admin).map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
          {/* Placeholder for footer content, e.g., settings or profile quick access */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-md">
            <div className="flex items-center gap-4">
                 <SidebarTrigger className="md:hidden" />
                 <div>
                    <h1 className="text-xl font-headline font-semibold">ProcessWise AI</h1>
                 </div>
            </div>
            <UserMenu user={user} signOut={signOutUser} loading={loading} />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

interface UserMenuProps {
  user: import('firebase/auth').User | null;
  signOut: () => Promise<void>;
  loading: boolean; // Pass loading to avoid rendering menu prematurely
}

function UserMenu({ user, signOut, loading }: UserMenuProps) {
  // If loading or no user, show skeleton or nothing to prevent flash of incorrect content
  if (loading) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }

  if (!user) {
    // This case should ideally be handled by redirects, but as a fallback:
    return <Skeleton className="h-10 w-10 rounded-full" />; 
  }
  
  const userInitial = user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.photoURL || `https://placehold.co/100x100.png`} alt={user.displayName || 'User Avatar'} data-ai-hint="user avatar" />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.displayName || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email || "No email"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled> {/* Settings not implemented */}
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
           <LogOut className="mr-2 h-4 w-4" /> 
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

    
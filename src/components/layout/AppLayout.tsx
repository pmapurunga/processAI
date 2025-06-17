
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, UploadCloud, MessageSquare, FileText, Settings, UserCog, LayoutDashboard, FileUp } from 'lucide-react';
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

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload PDF', icon: FileUp },
  // Chat and Summary links will be contextual or listed under documents.
  // For direct access, a general Chat or Summaries page could be added.
  // { href: '/chat', label: 'Chat', icon: MessageSquare },
  // { href: '/summaries', label: 'Summaries', icon: FileText },
  { href: '/admin/persona', label: 'AI Persona', icon: UserCog, admin: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // This should be replaced with actual auth state
  const isAdmin = true; 

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-4 flex items-center justify-between">
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
            <UserMenu />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}


function UserMenu() {
  // Replace with actual user data from auth
  const user = { name: "Admin User", email: "admin@processwise.ai", image: "" };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.image || `https://placehold.co/100x100.png`} alt={user.name} data-ai-hint="user avatar" />
            <AvatarFallback>{user.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          {/* <LogOut className="mr-2 h-4 w-4" /> */}
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


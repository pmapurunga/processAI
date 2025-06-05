"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn }
from "@/lib/utils";
import { Home, FilePlus, ListOrdered, Settings, ChevronDown, ChevronUp } from "lucide-react";
import React, { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"


interface NavLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
  isSubItem?: boolean;
}

const NavLink: React.FC<NavLinkProps> = ({ href, icon: Icon, label, isSubItem }) => {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Button
      asChild
      variant={isActive ? "secondary" : "ghost"}
      className={cn(
        "w-full justify-start",
        isSubItem ? "pl-10" : "pl-3",
        isActive && "font-semibold text-primary"
      )}
    >
      <Link href={href}>
        <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        {label}
      </Link>
    </Button>
  );
};


export function AppSidebar() {
  // Example recent processes - this would come from your state/API
  const [recentProcesses] = useState([
    // { id: "123", name: "Processo 12345-67.2023" },
    // { id: "456", name: "Processo 98765-43.2022" },
  ]);
  const [isRecentOpen, setIsRecentOpen] = useState(true);


  return (
    <aside className="hidden md:flex md:flex-col md:w-64 border-r bg-card fixed top-16 bottom-0 left-0 z-40">
      <ScrollArea className="flex-1 py-4">
        <nav className="grid items-start gap-1 px-2 text-sm font-medium">
          <NavLink href="/dashboard" icon={Home} label="Dashboard" />
          <NavLink href="/processes/create" icon={FilePlus} label="New Process" />
          
          <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
            <AccordionItem value="item-1" className="border-none">
              <AccordionTrigger 
                className="w-full justify-start hover:no-underline hover:bg-accent rounded-md px-3 py-2 text-sm font-medium text-foreground [&[data-state=open]>svg]:text-primary"
                onClick={() => setIsRecentOpen(!isRecentOpen)}
              >
                 <div className="flex items-center">
                  <ListOrdered className={cn("mr-3 h-5 w-5", isRecentOpen ? "text-primary" : "text-muted-foreground")} />
                  My Processes
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-0">
                {recentProcesses.length > 0 ? (
                  recentProcesses.map((process) => (
                    <NavLink
                      key={process.id}
                      href={`/processes/${process.id}/summary`} // Or specific subpage
                      icon={ListOrdered} // Could use a different icon for individual process
                      label={process.name}
                      isSubItem
                    />
                  ))
                ) : (
                  <p className="px-3 py-2 text-xs text-muted-foreground text-center">No recent processes.</p>
                )}
                 <Button variant="link" className="w-full justify-start pl-10 text-xs text-primary" asChild>
                   <Link href="/processes">View All Processes</Link>
                 </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* <NavLink href="/settings" icon={Settings} label="Settings" /> */}
        </nav>
      </ScrollArea>
      <div className="mt-auto p-4 border-t">
        <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} ProcessAI</p>
      </div>
    </aside>
  );
}

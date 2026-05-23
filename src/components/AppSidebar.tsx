import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, MessageSquare, FileSpreadsheet, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Button } from "./ui/button";

type Item = { title: string; url: string; icon: typeof Users; roles: AppRole[] };

const items: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "user"] },
  { title: "My Entries", url: "/entries", icon: FileSpreadsheet, roles: ["user"] },
  { title: "Users", url: "/users", icon: Users, roles: ["super_admin", "admin"] },
  { title: "Messages", url: "/messages", icon: MessageSquare, roles: ["super_admin", "admin"] },
];

export function AppSidebar() {
  const { role, profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const visible = items.filter((i) => role && i.roles.includes(role));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-lg gradient-emerald grid place-items-center text-white font-bold">
            ₿
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">Bet Entry</div>
            <div className="text-xs text-muted-foreground truncate">
              {profile?.username} · {role?.replace("_", " ")}
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="mt-auto p-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

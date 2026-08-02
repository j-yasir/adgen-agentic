"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/shared/providers/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import { Building2, Megaphone, LogOut, Zap } from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/businesses", label: "Businesses", icon: Building2, color: "text-indigo-500" },
  { href: "/campaigns/new", label: "New Campaign", icon: Megaphone, color: "text-violet-500" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={cn(
        "group/sidebar flex flex-col border-r border-slate-200 bg-white transition-all duration-200 ease-out shrink-0",
        expanded ? "w-56" : "w-14"
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-slate-100 px-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "linear-gradient(135deg,#1e1048 0%,#5b21b6 55%,#a855f7 100%)" }}
        >
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span
          className={cn(
            "ml-2.5 text-base font-bold text-slate-900 whitespace-nowrap transition-all duration-200",
            expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
          )}
        >
          AdGen
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              <item.icon
                className={cn(
                  "h-4.5 w-4.5 shrink-0 transition-colors",
                  active ? "text-indigo-500" : "text-slate-400 group-hover/sidebar:text-slate-600"
                )}
              />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200",
                  expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-slate-100 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-colors hover:bg-slate-50 outline-none">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
            >
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div
              className={cn(
                "flex flex-col items-start min-w-0 transition-all duration-200",
                expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
              )}
            >
              <span className="truncate text-sm font-medium text-slate-700 max-w-[140px]">
                {user?.name}
              </span>
              <span className="truncate text-xs text-slate-400 max-w-[140px]">
                {user?.email}
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right" className="w-48">
            <DropdownMenuItem
              onClick={logout}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

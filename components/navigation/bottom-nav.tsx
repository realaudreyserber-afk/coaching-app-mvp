"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Utensils, MessageSquare, TrendingUp, Settings } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Tableau", href: "/dashboard", icon: Home },
    { name: "Plan", href: "/plan", icon: Utensils },
    { name: "Coach", href: "/coach", icon: MessageSquare },
    { name: "Suivi", href: "/progress", icon: TrendingUp },
    { name: "Réglages", href: "/settings", icon: Settings },
  ];

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-900 pb-safe-bottom block"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                isActive
                  ? "text-amber-400 scale-105 font-medium"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] mt-1 tracking-wider uppercase">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

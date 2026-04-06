"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutGrid,
  PenTool,
  BarChart3,
  Settings,
  LogOut,
  Link2Icon,
  Calendar,
  Calendar1,
  Calendar1Icon,
  SparklesIcon,
  ListTodo
} from 'lucide-react';

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();

  const aiIcon = '✨'

  const navItems = [
    { id: '/dashboard', icon: LayoutGrid, label: 'Home', priority: 'high' },
    { id: '/dashboard/calendar', icon: Calendar1Icon, label: 'Calendar', priority: 'high' },
    { id: '/dashboard/compose', icon: PenTool, label: 'Compose', priority: 'high' },
    { id: '/dashboard/posts', icon: ListTodo, label: 'Posts', priority: 'high' },
    // { id: '/dashboard/chat', icon: SparklesIcon, label: 'Chat', priority: 'high' },
    { id: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', priority: 'high' },
    { id: '/dashboard/connect-accounts', icon: Link2Icon, label: 'Connect Accounts', priority: 'high' },
    { id: '/dashboard/settings', icon: Settings, label: 'Settings', priority: 'high' },
  ];

  useEffect(() => {
    navItems.forEach((item) => {
      router.prefetch(item.id);
    });
  }, [router]);

  const handleLogout = () => {
    signOut();
  };

  const prefetchOnHover = (path: string) => {
    router.prefetch(path);
  };

  return (
    <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-6 fixed left-0 top-0 bottom-0 overflow-hidden">
      <div className="flex-1 flex flex-col">
        <nav className="flex flex-col gap-2 mt-12">
          {navItems.map((item) => {
            const isActive = pathname === item.id;

            return (
              <Link
                key={item.id}
                href={item.id}
                prefetch={true}
                onMouseEnter={() => prefetchOnHover(item.id)}
                onTouchStart={() => prefetchOnHover(item.id)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                  }`}
                title={item.label}
              >
                {item.label === 'Chat' ? (<span className="text-2xl" aria-label="Chat">
                  {aiIcon}
                </span>
                ) : (<item.icon className="w-5 h-5" />
                )
                }
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-600 -ml-4 rounded-r-full hidden md:block"></div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
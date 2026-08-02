'use client';

import React, { useEffect } from "react"
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Lock, Settings, LogOut, Cookie, MessageSquare, Clock, Users as UsersIcon, LayoutGrid, Boxes, Download, Globe, Puzzle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/sonner';

const navigation = [
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Sessions', href: '/admin/sessions', icon: Settings },
  { name: 'Extension Proxy', href: '/admin/extension-proxy', icon: Globe },
  { name: 'Extensions', href: '/admin/extensions', icon: Puzzle },
  { name: 'Cookies', href: '/admin/cookies', icon: Cookie },
  { name: 'FD Containers', href: '/admin/freightdesk-sessions', icon: Boxes },
  { name: 'Swift Partner', href: '/admin/swift-partner-accounts', icon: LayoutGrid },
  { name: 'Messages', href: '/admin/messages', icon: MessageSquare },
  { name: 'Salesperson', href: '/admin/salesperson-commission', icon: Users },
  { name: 'Scheduler', href: '/admin/scheduler', icon: Clock },
  { name: 'App Updates', href: '/admin/updates', icon: Download },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [loading, isAuthenticated, pathname, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && pathname !== '/admin/login') {
    return null;
  }

  // Show login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-sidebar to-sidebar/95 border-r border-sidebar-border flex flex-col shadow-lg">
        {/* Logo */}
        <div className="px-6 py-8 border-b border-sidebar-border/50">
          <div className="flex items-center gap-3">
            <img src="/android-chrome-192x192.png" alt="DAT GO" className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-sidebar-primary to-primary bg-clip-text text-transparent">DAT GO</h1>
              <p className="text-xs text-sidebar-foreground/60">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-sidebar-primary to-primary text-sidebar-primary-foreground shadow-md'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-6 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <Toaster />
    </div>
  );
}

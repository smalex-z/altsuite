'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingBag, Server, Users, LogOut,
} from 'lucide-react';
import { getAuthStatus, logout } from '@/lib/api';

const navItems = [
  {
    href: '/', icon: LayoutDashboard, label: 'Overview', end: true,
  },
  {
    href: '/installed', icon: Package, label: 'Installed Apps', end: false,
  },
  {
    href: '/catalog', icon: ShoppingBag, label: 'App Catalog', end: false,
  },
  {
    href: '/users', icon: Users, label: 'Users', end: false,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        if (status.userMgmtConfigured && !status.hasUsers) {
          router.replace('/setup');
        } else if (status.userMgmtConfigured && status.hasUsers && !status.authenticated) {
          router.replace('/login');
        } else if (!status.setupComplete) {
          router.replace('/setup');
        } else if (
          status.domain
          && typeof window !== 'undefined'
          && !['localhost', '127.0.0.1'].includes(window.location.hostname)
          && window.location.hostname !== status.domain
        ) {
          window.location.href = `https://${status.domain}`;
        } else {
          setAuthChecked(true);
        }
      })
      .catch(() => {
        // API unreachable — let the dashboard load
        setAuthChecked(true);
      });
  }, [router]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (!authChecked) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Server className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-gray-900">AltSuite</h1>
              <p className="text-xs text-gray-500">FOSS Manager</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-auto">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = item.end
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="font-medium">Sign out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

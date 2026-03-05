'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingBag, Server, Wrench,
} from 'lucide-react';

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
    href: '/install', icon: Wrench, label: 'Installation Wizard', end: false,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

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
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

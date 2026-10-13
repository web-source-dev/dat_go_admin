'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import AlertsWatcher from '@/components/AlertsWatcher';

const links = [
  {
    href: '/admin/users',
    label: 'Users',
    icon: (
      <svg className="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.75" />
        <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35M16.5 3.7a3.5 3.5 0 0 1 0 6.6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: '/admin/emails',
    label: 'Emails',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    href: '/admin/activity',
    label: 'Activity',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M8 15l3-4 3 2 4-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    href: '/admin/loads',
    label: 'Loads',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 7h13v10H3zM16 10h4l1 3v4h-5V10z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <circle cx="7" cy="18.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="18" cy="18.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    href: '/admin/contacts',
    label: 'Contacts',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.75" />
        <path d="M7.5 17c1.2-2 2.8-3 4.5-3s3.3 1 4.5 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: '/admin/proxies',
    label: 'Proxies',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    href: '/admin/cookies',
    label: 'Cookies',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
        <circle cx="9" cy="10" r="1" fill="currentColor" />
        <circle cx="14.5" cy="9" r="1" fill="currentColor" />
        <circle cx="11" cy="14.5" r="1" fill="currentColor" />
        <circle cx="15.5" cy="14" r="1" fill="currentColor" />
      </svg>
    )
  },
  {
    href: '/admin/freightdesk',
    label: 'FD Containers',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path d="M3.3 7 12 12l8.7-5M12 22V12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: '/admin/swift-partner',
    label: 'Swift Partner',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 7h16M4 12h10M4 17h7"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    )
  },
  {
    href: '/admin/extensions',
    label: 'Extensions',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M14 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    )
  },
  {
    href: '/admin/updates',
    label: 'Updates',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 19h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    )
  }
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/admin/login');
  }, [loading, user, router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#eef2f7]">
      {/* Global dashboard alerts (sound + voice + desktop notifications) on every admin page. */}
      <AlertsWatcher />

      {/* Mobile drawer backdrop */}
      {navOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 h-screen w-[248px] shrink-0 flex flex-col bg-brand-900 text-white border-r border-black/10 transform transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Image
                src="/datdesk-icon.png"
                alt="Dat Desk"
                width={44}
                height={44}
                className="rounded-xl ring-1 ring-white/15"
                priority
              />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold tracking-tight leading-none">Dat Desk</div>
              <div className="mt-1.5 inline-flex items-center rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/70">
                Admin
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 mb-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35 px-3 mb-1.5">
            Manage
          </div>
          <nav className="space-y-0.5">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                    active
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-900/30'
                      : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  <span
                    className={`shrink-0 ${active ? 'text-white' : 'text-white/45 group-hover:text-white/80'}`}
                  >
                    {link.icon}
                  </span>
                  <span className="font-medium">{link.label}</span>
                  {active ? (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/90" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-3">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Signed in</div>
            <div className="text-xs text-white/80 truncate mb-3" title={user.email}>
              {user.email}
            </div>
            <button
              onClick={logout}
              className="w-full rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium py-2 transition"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="relative flex-1 min-w-0 min-h-screen overflow-auto">
        {/* Mobile top bar with hamburger (hidden on desktop) */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 bg-brand-900 text-white px-4 h-14 shadow-md">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
            className="inline-flex items-center justify-center rounded-lg p-2 -ml-2 hover:bg-white/10"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <Image src="/datdesk-icon.png" alt="Dat Desk" width={28} height={28} className="rounded-lg ring-1 ring-white/15" />
          <span className="text-sm font-semibold tracking-tight">Dat Desk Admin</span>
        </div>
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 100% 0%, rgba(11,107,203,0.10), transparent 50%), linear-gradient(180deg, #f4f7fb 0%, #e9eef5 100%)'
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(rgba(10,47,87,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(10,47,87,0.07) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse 85% 70% at 50% 30%, black 10%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 85% 70% at 50% 30%, black 10%, transparent 75%)'
          }}
        />
        <div className="relative z-10 w-full p-4 sm:p-5 md:p-7 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

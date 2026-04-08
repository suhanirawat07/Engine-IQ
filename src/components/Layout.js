import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";

const navLinks = [
  { to: "/", label: "Home", exact: true },
  { to: "/dashboard", label: "Diagnose" },
  { to: "/history", label: "History" },
  { to: "/manual", label: "User Manual" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const role = (user?.role || "user").toLowerCase();
  const roleLabel = role === "admin" ? "Admin" : "User";
  const navItems = role === "admin"
    ? [...navLinks, { to: "/admin/retrain", label: "Admin Monitor" }]
    : navLinks;
  const roleBadgeClass =
    role === "admin"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
      : "bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-slate-600";

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen app-shell font-sans">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-slate-900/75 backdrop-blur-md border-b border-stone-300 dark:border-slate-700 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-bold shadow-lg shadow-amber-500/30">
              ⚡
            </div>
            <span className="font-bold text-stone-900 dark:text-stone-100 text-sm tracking-wide hidden sm:block">
              ENGINE-
              <span className="text-amber-400">IQ</span>
            </span>
          </NavLink>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      : "text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-50 hover:bg-stone-100 dark:hover:bg-slate-800"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          {/* Auth */}
          <div className="hidden md:flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="h-9 w-9 rounded-lg border border-stone-300 dark:border-slate-600 text-stone-600 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            >
              {isDark ? "☀" : "☾"}
            </button>
            {user ? (
              <>
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full border-2 border-amber-500/50"
                />
                <span className="text-sm text-stone-600 dark:text-stone-300 max-w-[120px] truncate">{user.displayName}</span>
                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${roleBadgeClass}`}>
                  {roleLabel}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm text-stone-600 dark:text-stone-300 hover:text-red-400 border border-stone-300 dark:border-slate-600 hover:border-red-500/50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                >
                  Sign out
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                className="px-4 py-2 bg-amber-500 hover:bg-cyan-400 text-gray-950 font-semibold text-sm rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                Sign In
              </NavLink>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="h-9 w-9 rounded-lg border border-stone-300 dark:border-slate-600 text-stone-600 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-800 transition-all duration-200"
            >
              {isDark ? "☀" : "☾"}
            </button>
            <button
              className="p-2 rounded-lg border border-stone-300 dark:border-slate-600 text-stone-600 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-800 transition-all duration-200"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-t border-stone-300 dark:border-slate-700 px-4 py-3 flex flex-col gap-2">
            {navItems.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? "bg-amber-500/10 text-amber-500"
                      : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-slate-800"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            {user ? (
              <>
                <div className="px-4 py-1 text-xs text-stone-600 dark:text-stone-300">
                  Signed in as <span className="font-semibold text-stone-900 dark:text-stone-100">{user.displayName}</span>
                  <span className={`ml-2 px-2 py-0.5 text-[11px] font-semibold rounded-full border ${roleBadgeClass}`}>
                    {roleLabel}
                  </span>
                </div>
                <button onClick={handleLogout} className="px-4 py-2 text-sm text-red-500 text-left hover:bg-red-500/10 rounded-lg transition-colors duration-200">
                  Sign out
                </button>
              </>
            ) : (
              <NavLink to="/login" onClick={() => setMenuOpen(false)} className="px-4 py-2 text-sm text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors duration-200">
                Sign In
              </NavLink>
            )}
          </div>
        )}
      </nav>

      {/* ── Page content ── */}
      <main className="pt-16 min-h-screen">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-stone-300 dark:border-slate-700 py-6 text-center text-xs text-stone-500 dark:text-stone-400 transition-colors duration-300">
        © {new Date().getFullYear()} EngineScan — Hybrid Intelligent Engine Health Monitoring System
      </footer>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronDown, Shield } from 'lucide-react';
import { useAuth } from '../lib/auth.js';
import { roleLabel, normalizeRole } from '../lib/format.js';
import { LanguageSelector } from './LanguageSelector.js';

export function AppHeader() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  if (!me) return null;

  const norm = normalizeRole(me.role);
  const friendlyRole = roleLabel(me.role);
  const homePath = norm === 'TRAINER' ? '/trainer' : norm === 'ADMINISTRATOR' ? '/admin' : '/';
  const initial = me.nameEn ? me.nameEn.trim().charAt(0).toUpperCase() : 'U';

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-surface px-4 lg:px-6">
      {/* Brand / System Context */}
      <div className="flex items-center gap-3">
        <Link
          to={homePath}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
          title="STATINTEL Dashboard"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-white font-bold text-sm shadow-xs">
            SI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[17px] font-bold tracking-tight text-ink">STATINTEL</span>
              <span className="hidden md:inline-flex rounded bg-primary-soft border border-primary/20 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                Official System
              </span>
            </div>
            <p className="hidden sm:block text-[11px] leading-tight text-subtle">
              National Statistical Systems Training Academy (NSSTA) &amp; MoSPI
            </p>
          </div>
        </Link>
      </div>

      {/* Right Controls: Language Selector & User Profile Dropdown */}
      <div className="flex items-center gap-3">
        <LanguageSelector compact />

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left transition-all hover:border-primary/50 hover:bg-raised focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-2xs"
          >
            {/* Avatar Circle */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[13px] border border-primary/25">
              {initial}
            </div>

            {/* User Name & Friendly Application Role */}
            <div className="hidden sm:flex flex-col min-w-0 pr-1 text-left">
              <div className="flex items-center gap-1">
                <span className="truncate max-w-[150px] text-[13px] font-semibold text-ink leading-tight">
                  {me.nameEn}
                </span>
                <ChevronDown
                  size={13}
                  className={`text-subtle transition-transform duration-150 ${dropdownOpen ? 'rotate-180 text-primary' : ''}`}
                  aria-hidden="true"
                />
              </div>
              <span className="text-[11px] font-medium text-primary leading-tight mt-0.5">
                {friendlyRole}
              </span>
            </div>

            <ChevronDown
              size={14}
              className={`sm:hidden text-subtle transition-transform ${dropdownOpen ? 'rotate-180 text-primary' : ''}`}
              aria-hidden="true"
            />
          </button>

          {/* Profile & Session Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-border bg-surface p-1.5 shadow-md animate-in fade-in slide-in-from-top-1 duration-150 z-50">
              {/* Profile Details Header */}
              <div className="rounded border-b border-border/70 px-3 py-2.5 bg-raised/40 mb-1">
                <p className="truncate text-[13px] font-bold text-ink">{me.nameEn}</p>
                <p className="truncate text-[11px] text-muted font-mono">{me.email}</p>
                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className="inline-flex items-center gap-1 rounded bg-primary-soft border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                    <Shield size={10} /> {friendlyRole}
                  </span>
                  <span className="truncate text-[10.5px] text-subtle max-w-[120px]" title={me.designation}>
                    {me.designation}
                  </span>
                </div>
              </div>

              {/* Action: My Profile */}
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/profile');
                }}
                className="w-full flex items-center gap-2.5 rounded px-3 py-2 text-[13px] font-medium text-ink hover:bg-primary-soft hover:text-primary transition-colors cursor-pointer text-left"
              >
                <User size={15} className="text-primary shrink-0" aria-hidden="true" />
                <span>My Profile</span>
              </button>

              <div className="my-1 border-t border-border/70" />

              {/* Action: Logout */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 rounded px-3 py-2 text-[13px] font-medium text-critical hover:bg-critical/10 transition-colors cursor-pointer text-left"
              >
                <LogOut size={15} className="shrink-0" aria-hidden="true" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

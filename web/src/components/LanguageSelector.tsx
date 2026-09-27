import { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation, SUPPORTED_LANGUAGES } from '../lib/i18n/index.js';

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, isBhashiniConfigured } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language) ?? SUPPORTED_LANGUAGES[0]!;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded border border-border/80 bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-bg transition-colors cursor-pointer ${
          compact ? 'text-[11px] py-0.5 px-2' : ''
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Change application language"
      >
        <Globe size={13} className="text-primary shrink-0" aria-hidden="true" />
        <span className="font-semibold">{currentLang.nativeName}</span>
        <ChevronDown size={11} className={`text-subtle transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-48 origin-top-right rounded-md border border-border bg-surface py-1 shadow-md focus:outline-none">
          <div className="px-3 py-1.5 border-b border-border/60">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Select Language / भाषा</p>
            <p className="text-[10px] text-muted">
              {isBhashiniConfigured ? 'Bhashini Pipeline Active' : 'Local dictionary fallback'}
            </p>
          </div>

          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary-soft font-semibold text-primary' : 'text-ink hover:bg-bg'
                }`}
              >
                <div>
                  <span className="block text-[13px]">{lang.nativeName}</span>
                  <span className="block text-[10px] text-subtle">{lang.label}</span>
                </div>
                {isSelected && <Check size={14} className="text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

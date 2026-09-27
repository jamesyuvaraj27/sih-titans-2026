import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import { en, type TranslationKey } from './translations/en.js';
import { hi } from './translations/hi.js';
import { te } from './translations/te.js';
import { post } from '../api.js';

export type Language = 'en' | 'hi' | 'te';

export interface LanguageInfo {
  code: Language;
  label: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'te', label: 'Telugu', nativeName: 'తెలుగు' },
];

const DICTIONARIES: Record<Language, Partial<Record<TranslationKey, string>>> = {
  en,
  hi,
  te,
};

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, defaultText?: string, vars?: Record<string, string | number>) => string;
  isBhashiniConfigured: boolean;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

const STORAGE_KEY = 'statintel_preferred_language';

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'hi' || stored === 'te') {
        return stored;
      }
    } catch {
      // ignore localStorage errors
    }
    return 'en';
  });

  const [isBhashiniConfigured, setIsBhashiniConfigured] = useState(false);

  // Check translation backend status (Bhashini-readiness)
  useEffect(() => {
    fetch('/api/translation/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.bhashiniConfigured) {
          setIsBhashiniConfigured(true);
        }
      })
      .catch(() => {
        // Fallback silently without throwing
        setIsBhashiniConfigured(false);
      });
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage error
    }

    // Attempt to persist to official profile on server if logged in
    post('/auth/language', { language: lang }).catch(() => {
      // Ignore background sync failure, local state remains active
    });
  };

  const t = useMemo(() => {
    return (key: TranslationKey, defaultText?: string, vars?: Record<string, string | number>): string => {
      // 1. Try selected language
      let text = DICTIONARIES[language]?.[key];

      // 2. Fall back to English
      if (!text && language !== 'en') {
        text = DICTIONARIES.en[key];
      }

      // 3. Fall back to provided default text or key itself
      if (!text) {
        text = defaultText || key;
      }

      // Variable interpolation: e.g. "Hello {name}"
      if (vars && text) {
        Object.entries(vars).forEach(([k, v]) => {
          text = text!.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }

      return text;
    };
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isBhashiniConfigured,
    }),
    [language, t, isBhashiniConfigured],
  );

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return ctx;
}

export { type TranslationKey };

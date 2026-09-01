import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { stringsFor, type AppLanguage, type Strings } from "../lib/i18n";

const LANG_KEY = "xcollab.language";

interface UiValue {
  language: AppLanguage;
  t: Strings;
  /** True when the language was just switched to a direction the current
      native layout doesn't match — full mirroring needs an app restart. */
  rtlPending: boolean;
  setLanguage: (next: AppLanguage) => void;
}

const UiContext = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");
  const [rtlPending, setRtlPending] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then((stored) => {
        if (stored === "ar" || stored === "en") setLanguageState(stored);
      })
      .catch(() => {
        /* default stays en */
      });
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    AsyncStorage.setItem(LANG_KEY, next).catch(() => {
      /* preference just won't survive restart */
    });
    const wantRtl = next === "ar";
    if (I18nManager.isRTL !== wantRtl) {
      // Takes effect on next launch; strings and per-view alignment flip now.
      I18nManager.allowRTL(wantRtl);
      I18nManager.forceRTL(wantRtl);
      setRtlPending(true);
    } else {
      setRtlPending(false);
    }
  }, []);

  return (
    <UiContext.Provider value={{ language, t: stringsFor(language), rtlPending, setLanguage }}>
      {children}
    </UiContext.Provider>
  );
}

export function useUi(): UiValue {
  const value = useContext(UiContext);
  if (!value) throw new Error("useUi outside UiProvider");
  return value;
}

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AppSettings {
  discreteMode: boolean;
  setDiscreteMode: (v: boolean) => void;
  baseCurrency: 'BRL' | 'USDT';
  setBaseCurrency: (v: 'BRL' | 'USDT') => void;
}

const AppSettingsContext = createContext<AppSettings>({
  discreteMode: false,
  setDiscreteMode: () => {},
  baseCurrency: 'BRL',
  setBaseCurrency: () => {},
});

export const AppSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [discreteMode, setDiscreteModeState] = useState(() => {
    try { return localStorage.getItem('pf_discrete') === 'true'; } catch { return false; }
  });
  const [baseCurrency, setBaseCurrencyState] = useState<'BRL' | 'USDT'>(() => {
    try { return (localStorage.getItem('pf_currency') as 'BRL' | 'USDT') || 'BRL'; } catch { return 'BRL'; }
  });

  const setDiscreteMode = (v: boolean) => {
    setDiscreteModeState(v);
    try { localStorage.setItem('pf_discrete', String(v)); } catch { /* storage unavailable */ }
  };

  const setBaseCurrency = (v: 'BRL' | 'USDT') => {
    setBaseCurrencyState(v);
    try { localStorage.setItem('pf_currency', v); } catch { /* storage unavailable */ }
  };

  return (
    <AppSettingsContext.Provider value={{ discreteMode, setDiscreteMode, baseCurrency, setBaseCurrency }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => useContext(AppSettingsContext);

/** Masks a value when discrete mode is on */
export const useDiscreteValue = (value: string): string => {
  const { discreteMode } = useAppSettings();
  return discreteMode ? '••••' : value;
};

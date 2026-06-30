import React, { createContext, useContext, useState } from 'react';

interface HeatmapState {
  scaleMode: 'absolute' | 'relative';
  setScaleMode: (mode: 'absolute' | 'relative') => void;
}

const HeatmapContext = createContext<HeatmapState | undefined>(undefined);

export const HeatmapStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scaleMode, setScaleMode] = useState<'absolute' | 'relative'>('absolute');
  return (
    <HeatmapContext.Provider value={{ scaleMode, setScaleMode }}>
      {children}
    </HeatmapContext.Provider>
  );
};

export const useHeatmapState = () => {
  const context = useContext(HeatmapContext);
  if (!context) throw new Error("useHeatmapState must be used within HeatmapStateProvider");
  return context;
};

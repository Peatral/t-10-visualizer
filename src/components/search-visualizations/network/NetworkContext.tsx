import React, { createContext, useContext, useState } from 'react';

interface NetworkState {
  weightFilter: number;
  setWeightFilter: (val: number) => void;
}

const NetworkContext = createContext<NetworkState | undefined>(undefined);

export const NetworkStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [weightFilter, setWeightFilter] = useState(2);
  return (
    <NetworkContext.Provider value={{ weightFilter, setWeightFilter }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetworkState = () => {
  const context = useContext(NetworkContext);
  if (!context) throw new Error("useNetworkState must be used within NetworkStateProvider");
  return context;
};

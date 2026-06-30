import React, { createContext, useContext, useState } from 'react';

interface ListState {
  sortBy: 'newest' | 'oldest';
  setSortBy: (sort: 'newest' | 'oldest') => void;
}

const ListContext = createContext<ListState | undefined>(undefined);

export const ListStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  return (
    <ListContext.Provider value={{ sortBy, setSortBy }}>
      {children}
    </ListContext.Provider>
  );
};

export const useListState = () => {
  return useContext(ListContext);
};

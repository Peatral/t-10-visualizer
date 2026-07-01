import React, { createContext, useContext, useState } from 'react';

export type SortMode = 'newest' | 'oldest' | 'relevant';
interface ListState {
  sortBy: SortMode;
  setSortBy: (sort: SortMode) => void;
}

const ListContext = createContext<ListState | undefined>(undefined);

export const ListStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sortBy, setSortBy] = useState<SortMode>('newest');
  return (
    <ListContext.Provider value={{ sortBy, setSortBy }}>
      {children}
    </ListContext.Provider>
  );
};

export const useListState = () => {
  return useContext(ListContext);
};

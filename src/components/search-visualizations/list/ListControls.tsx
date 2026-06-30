import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation, type Language } from '../../../context';
import { useListState } from './ListContext';

export const ListControls: React.FC<{ language: Language }> = () => {
  const listState = useListState();
  const { t } = useTranslation();
  if (!listState) return null;
  const { sortBy, setSortBy } = listState;
  return (
    <div className="shrink-0 flex items-center gap-2 bg-[#252525] px-3 py-1.5 border border-[#2e2e2e]">
      <span className="text-[11px] text-gray-400 font-medium font-mono">{t('sortBy')}:</span>
      <div className="relative">
        <select 
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
          className="bg-[#1a1a1a] text-white pl-2 pr-6 py-0.5 text-xs font-semibold focus:outline-none appearance-none cursor-pointer font-sans"
        >
          <option value="newest">{t('newest')}</option>
          <option value="oldest">{t('oldest')}</option>
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-1.5 top-1 pointer-events-none" />
      </div>
    </div>
  );
};

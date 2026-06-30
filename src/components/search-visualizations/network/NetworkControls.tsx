import React from 'react';
import { type Language } from '../../../context';
import { useNetworkState } from './NetworkContext';

export const NetworkControls: React.FC<{ language: Language }> = ({ language }) => {
  const { weightFilter, setWeightFilter } = useNetworkState();
  return (
    <div className="shrink-0 flex items-center gap-3 bg-[#252525] px-3 py-1.5 border border-[#2e2e2e]">
      <span className="text-[11px] text-gray-400 font-medium font-mono whitespace-nowrap">
        {language === 'de' ? 'Min. Verbindungsgewicht' : 'Min Connection Weight'}: {weightFilter}
      </span>
      <input 
        type="range" 
        min="2" 
        max="15" 
        step="1" 
        value={weightFilter} 
        onChange={(e) => setWeightFilter(parseInt(e.target.value, 10))}
        className="w-28 accent-[#5c6bc0] bg-[#1a1a1a] h-1.5 rounded-lg cursor-pointer"
      />
    </div>
  );
};

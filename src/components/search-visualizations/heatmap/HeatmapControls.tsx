import React from 'react';
import { useTranslation, type Language } from '../../../context';
import { useHeatmapState } from './HeatmapContext';

export const HeatmapControls: React.FC<{ language: Language }> = () => {
  const { scaleMode, setScaleMode } = useHeatmapState();
  const { t } = useTranslation();
  return (
    <div className="shrink-0 flex bg-[#252525] p-0.5 text-[10px] font-semibold border border-[#2e2e2e]">
      <button 
        onClick={() => setScaleMode('absolute')} 
        className={`px-2.5 py-1 transition-colors cursor-pointer ${scaleMode === 'absolute' ? 'bg-[#3f51b5] text-white font-bold' : 'text-gray-400 hover:text-white'}`}
      >
        {t('absoluteMode') || 'Absolute'}
      </button>
      <button 
        onClick={() => setScaleMode('relative')} 
        className={`px-2.5 py-1 transition-colors cursor-pointer ${scaleMode === 'relative' ? 'bg-[#3f51b5] text-white font-bold' : 'text-gray-400 hover:text-white'}`}
      >
        {t('relativeMode') || 'Relative'}
      </button>
    </div>
  );
};

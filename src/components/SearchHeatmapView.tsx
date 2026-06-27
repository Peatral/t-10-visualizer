import React from 'react';
import { HeatmapTable } from './HeatmapTable';
import type { TrendmapCalculationResult } from '../server/router';

interface SearchHeatmapViewProps {
  trendmapResult?: TrendmapCalculationResult;
  heatmapScaleMode: 'absolute' | 'relative';
  isHeatmapLoading: boolean;
  handleCellClick: (topicId: string, displayLabel: string, bucket: string) => void;
  handleRowClick: (topicId: string, displayLabel: string) => void;
  handleColumnClick: (bucket: string) => void;
}

export const SearchHeatmapView: React.FC<SearchHeatmapViewProps> = ({
  trendmapResult,
  heatmapScaleMode,
  isHeatmapLoading,
  handleCellClick,
  handleRowClick,
  handleColumnClick
}) => {
  return (
    <div className="h-full relative overflow-auto bg-[#121212]">
      {isHeatmapLoading || !trendmapResult ? (
        <div className="absolute inset-0 z-40 bg-[#121212]/90 flex flex-col items-center justify-center text-gray-500 gap-4">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold tracking-wider text-gray-500 animate-pulse">
            Calculating Heatmap Grid...
          </span>
        </div>
      ) : (
        <HeatmapTable
          topWords={trendmapResult.topDisplayKeys}
          croppedTimeScale={trendmapResult.croppedTimeScale}
          grid={trendmapResult.grid}
          displayGrid={heatmapScaleMode === 'relative' ? trendmapResult.relativeGrid : undefined}
          weightGrid={heatmapScaleMode === 'relative' ? trendmapResult.relativeWeights : undefined}
          topicKeywords={trendmapResult.topicKeywords}
          labelToDisplay={trendmapResult.labelToDisplay}
          maxCellCount={trendmapResult.maxCellCount}
          maxDisplayWeight={heatmapScaleMode === 'relative' ? trendmapResult.maxRelativeWeight : undefined}
          handleCellClick={handleCellClick}
          handleRowClick={handleRowClick}
          handleColumnClick={handleColumnClick}
        />
      )}
    </div>
  );
};

import React from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTRPC } from '../utils/trpc';
import { HeatmapTable } from './HeatmapTable';

interface SearchHeatmapViewProps {
  parsedFilters: {
    category?: string;
    q?: string;
    before?: string;
    after?: string;
    topic?: string;
  };
  language: 'de' | 'en';
  heatmapScaleMode: 'absolute' | 'relative';
  handleCellClick: (topicId: string, displayLabel: string, bucket: string) => void;
  handleRowClick: (topicId: string, displayLabel: string) => void;
  handleColumnClick: (bucket: string) => void;
}

export const SearchHeatmapView: React.FC<SearchHeatmapViewProps> = ({
  parsedFilters,
  language,
  heatmapScaleMode,
  handleCellClick,
  handleRowClick,
  handleColumnClick
}) => {
  const trpc = useTRPC();

  const { data: trendmapResult } = useSuspenseQuery(
    trpc.getTrendmapGrid.queryOptions({
      category: parsedFilters.category,
      language,
      q: parsedFilters.q,
      before: parsedFilters.before,
      after: parsedFilters.after,
      topic: parsedFilters.topic,
    })
  );

  return (
    <div className="h-full relative overflow-auto bg-[#121212]">
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
    </div>
  );
};

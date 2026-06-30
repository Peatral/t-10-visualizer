import React from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTRPC } from '../../../utils/trpc';
import { HeatmapTable } from '../../HeatmapTable';
import type { ParsedSearchQuery } from '../../../utils/searchParser';
import { type Language } from '../../../context';
import type { Article } from '../../../server/db/schema';
import { useHeatmapState } from './HeatmapContext';

interface SearchHeatmapViewProps {
  parsedFilters: ParsedSearchQuery;
  language: Language;
  onArticleClick?: (article: Article) => void;
  onCellClick: (topicId: string, displayLabel: string, bucket: string) => void;
  onRowClick: (topicId: string, displayLabel?: string) => void;
  onColumnClick: (bucket: string) => void;
}

export const SearchHeatmapView: React.FC<SearchHeatmapViewProps> = ({
  parsedFilters,
  language,
  onCellClick,
  onRowClick,
  onColumnClick
}) => {
  const { scaleMode } = useHeatmapState();
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
    <div className="h-full relative flex overflow-hidden bg-[#121212]">
      <HeatmapTable
        topWords={trendmapResult.topDisplayKeys}
        croppedTimeScale={trendmapResult.croppedTimeScale}
        grid={trendmapResult.grid}
        displayGrid={scaleMode === 'relative' ? trendmapResult.relativeGrid : undefined}
        weightGrid={scaleMode === 'relative' ? trendmapResult.relativeWeights : undefined}
        topicKeywords={trendmapResult.topicKeywords}
        labelToDisplay={trendmapResult.labelToDisplay}
        maxCellCount={trendmapResult.maxCellCount}
        maxDisplayWeight={scaleMode === 'relative' ? trendmapResult.maxRelativeWeight : undefined}
        handleCellClick={onCellClick}
        handleRowClick={onRowClick}
        handleColumnClick={onColumnClick}
      />
    </div>
  );
};

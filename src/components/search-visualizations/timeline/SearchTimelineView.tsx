import React, { useEffect, useRef, useEffectEvent } from 'react';
import { DataSet } from 'vis-data';
import { Timeline as VisTimeline } from 'vis-timeline';
import type { Article } from '../../../server/db/schema';
import { useFilteredArticles } from '../shared/useFilteredArticles';
import type { ParsedSearchQuery } from '../../../utils/searchParser';
import type { Language } from '../../../context';

interface SearchTimelineViewProps {
  parsedFilters: ParsedSearchQuery;
  language: Language;
  onArticleClick: (article: Article) => void;
}

export const SearchTimelineView: React.FC<SearchTimelineViewProps> = ({ parsedFilters, onArticleClick }) => {
  const articles = useFilteredArticles(parsedFilters);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineInstance = useRef<VisTimeline | null>(null);

  const datasetRef = useRef(new DataSet<any>());

  const handleArticleClick = useEffectEvent((article: Article) => {
    onArticleClick(article);
  });

  useEffect(() => {
    if (!timelineRef.current) return;

    const options = {
      width: '100%',
      height: '100%',
      margin: {
        item: {
          horizontal: 6,
          vertical: 4
        }
      },
      type: 'point' as const,
      throttleRedraw: 20,
      stack: true,
      maxHeight: '100%',
      zoomMin: 1000 * 60 * 60 * 24 * 30,
      zoomMax: 1000 * 60 * 60 * 24 * 365 * 40
    };

    const frameId = requestAnimationFrame(() => {
      if (!timelineRef.current) return;
      
      const timeline = new VisTimeline(timelineRef.current, datasetRef.current, options);
      timelineInstance.current = timeline;

      timeline.on('select', (properties) => {
        if (properties.items && properties.items.length > 0) {
          const itemId = properties.items[0];
          const matchedArticle = articles.find(a => a.id === itemId);
          if (matchedArticle) {
            handleArticleClick(matchedArticle);
          }
        }
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (timelineInstance.current) {
        timelineInstance.current.destroy();
        timelineInstance.current = null;
      }
    };
  }, [articles]);

  useEffect(() => {
    const items = articles.map(art => ({
      id: art.id,
      content: art.title,
      start: new Date(art.date),
      className: 'bg-[#3f51b5] border-[#3f51b5] text-white hover:opacity-85 cursor-pointer rounded px-2 py-0.5 text-[11px] font-sans font-medium select-none max-w-sm truncate'
    }));

    datasetRef.current.clear();
    datasetRef.current.add(items);

    if (timelineInstance.current) {
      timelineInstance.current.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
    }
  }, [articles]);

  return (
    <div className="w-full h-full p-4 bg-[#121212] select-none text-left">
      <div 
        ref={timelineRef} 
        className="w-full h-full border border-[#2e2e2e] bg-[#1e1e1e] text-white shadow-lg overflow-hidden [&_.vis-time-axis]:!text-gray-400 [&_.vis-text]:!text-gray-300 [&_.vis-current-time]:!bg-red-500 [&_.vis-custom-time]:!bg-green-500 [&_.vis-grid]:!border-[#2a2a2a] [&_.vis-foreground]:!border-[#2e2e2e]"
      />
    </div>
  );
};

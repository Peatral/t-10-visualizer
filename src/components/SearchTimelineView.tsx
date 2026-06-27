import React, { useState, useEffect, useRef } from 'react';
import { DataSet } from 'vis-data';
import { Timeline as VisTimeline } from 'vis-timeline';
import type { Article } from '../server/db/schema';

interface SearchTimelineViewProps {
  articles: Article[];
  onArticleClick: (article: Article) => void;
}

export const SearchTimelineView: React.FC<SearchTimelineViewProps> = ({ articles, onArticleClick }) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineInstance = useRef<VisTimeline | null>(null);
  const [isTimelineInitializing, setIsTimelineInitializing] = useState(false);

  useEffect(() => {
    if (!timelineRef.current) return;

    setIsTimelineInitializing(true);

    if (timelineInstance.current) {
      timelineInstance.current.destroy();
      timelineInstance.current = null;
    }

    const timer = setTimeout(() => {
      if (!timelineRef.current) return;

      interface VisTimelineItem {
        id: number;
        content: string;
        start: string;
        rawIndex: number;
        rawArticle: Article;
      }

      const visItems = articles.map((art, index) => ({
        id: index,
        content: art.title,
        start: art.date,
        rawIndex: index,
        rawArticle: art
      }));

      const items = new DataSet<VisTimelineItem>(visItems);

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

      const timeline = new VisTimeline(timelineRef.current, items, options);
      timelineInstance.current = timeline;

      timeline.on('select', (properties) => {
        if (properties.items.length > 0) {
          const selectedId = properties.items[0] as number;
          const item = items.get(selectedId);
          if (item && item.rawArticle) {
            onArticleClick(item.rawArticle);
          }
        }
      });

      setIsTimelineInitializing(false);
    }, 60);

    return () => {
      clearTimeout(timer);
      if (timelineInstance.current) {
        timelineInstance.current.destroy();
        timelineInstance.current = null;
      }
    };
  }, [articles, onArticleClick]);

  return (
    <div className="h-full relative overflow-hidden bg-[#121212]">
      {isTimelineInitializing && (
        <div className="absolute inset-0 z-40 bg-[#121212] flex flex-col items-center justify-center text-gray-500 gap-4">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold tracking-wider text-gray-500 animate-pulse">
            Initializing Timeline...
          </span>
        </div>
      )}
      <div ref={timelineRef} className="h-full w-full" />
    </div>
  );
};

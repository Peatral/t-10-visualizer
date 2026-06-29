import React, { useEffect, useRef, useEffectEvent } from 'react';
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
        if (properties.items.length > 0) {
          const selectedId = properties.items[0] as number;
          const item = datasetRef.current.get(selectedId);
          if (item?.rawArticle) {
            handleArticleClick(item.rawArticle);
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
  }, []);

  useEffect(() => {
    const visItems = articles.map((art, index) => ({
      id: index,
      content: art.title,
      start: art.date,
      rawIndex: index,
      rawArticle: art
    }));

    datasetRef.current.clear();
    datasetRef.current.add(visItems);
  }, [articles]);

  return (
    <div className="h-full w-full bg-[#121212]">
      <div ref={timelineRef} className="h-full w-full" />
    </div>
  );
};

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CategoryBadge } from './CategoryBadge';
import { PublishedDateBadge } from './PublishedDateBadge';
import { useTranslation } from '../context';
import type { Article } from '../server/db/schema';

interface SearchListViewProps {
  articles: Article[];
  onArticleClick: (article: Article) => void;
}

export const SearchListView: React.FC<SearchListViewProps> = ({ articles, onArticleClick }) => {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: articles.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  return (
    <div ref={scrollContainerRef} className="h-full overflow-auto bg-[#121212]">
      <table className="w-full text-left text-xs border-collapse block">
        {/* Table Header - sticky to the top of the scrolling container */}
        <thead className="block sticky top-0 z-10 bg-[#181818] border-b border-[#2e2e2e] text-gray-500 w-full">
          <tr className="flex w-full">
            <th className="p-3.5 font-bold w-28 shrink-0 font-mono">{t('published')}</th>
            <th className="p-3.5 font-bold w-48 shrink-0">{t('category')}</th>
            <th className="p-3.5 font-bold flex-1">{t('title')}</th>
          </tr>
        </thead>
        
        {/* Virtualized Body Container */}
        <tbody 
          className="block relative w-full divide-y divide-[#222]"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const art = articles[virtualRow.index];
            if (!art) return null;
            
            return (
              <tr
                key={art.id}
                onClick={() => onArticleClick(art)}
                className="flex hover:bg-[#202020]/50 text-gray-300 cursor-pointer transition-colors border-b border-[#222]/50 absolute top-0 left-0 w-full"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <td className="p-3.5 w-28 shrink-0 flex items-center">
                  <PublishedDateBadge date={art.date} variant="small" />
                </td>
                <td className="p-3.5 w-48 shrink-0 flex items-center">
                  <CategoryBadge category={art.category} variant="small" />
                </td>
                <td className="p-3.5 flex-1 min-w-0 flex items-center">
                  <div className="space-y-1 w-full">
                    <div className="font-bold text-white text-sm font-sans truncate">{art.title}</div>
                    <div className="text-gray-500 line-clamp-1 max-w-4xl text-xs font-sans">{art.description}</div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

import React from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from '../context';
import { parseSearchQuery, stringifySearchQuery } from '../utils/searchParser';

interface TopicTagProps {
  nameDe: string;
  nameEn: string;
  topicId?: string;
}

export const TopicTag: React.FC<TopicTagProps> = ({ nameDe, nameEn, topicId }) => {
  const { language } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as any;
  const currentQ = searchParams?.q || '';
  const label = language === 'de' ? nameDe : nameEn;

  const handleClick = (e: React.MouseEvent) => {
    if (!topicId) return;
    e.stopPropagation(); // Prevent parent row selection clicks
    const parsed = parseSearchQuery(currentQ);
    parsed.topic = topicId;
    const newQ = stringifySearchQuery(parsed);
    navigate({
      to: '/search',
      search: { q: newQ, view: searchParams?.view || 'list' }
    });
  };

  return (
    <span
      onClick={handleClick}
      className="text-[10px] font-semibold bg-[#2a3c2c]/40 text-green-400 px-2 py-0.5 select-none font-mono cursor-pointer hover:bg-[#2a3c2c]/65 hover:text-green-300 transition-colors"
      title={topicId ? `Topic ID: ${topicId}` : undefined}
    >
      {label}
    </span>
  );
};

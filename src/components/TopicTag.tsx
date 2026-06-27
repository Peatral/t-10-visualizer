import React from 'react';
import { useTranslation } from '../context';

interface TopicTagProps {
  nameDe: string;
  nameEn: string;
  topicId?: string;
}

export const TopicTag: React.FC<TopicTagProps> = ({ nameDe, nameEn, topicId }) => {
  const { language } = useTranslation();
  const label = language === 'de' ? nameDe : nameEn;

  return (
    <span
      className="text-[10px] font-semibold bg-[#2a3c2c]/40 text-green-400 px-2 py-0.5 select-none font-mono"
      title={topicId ? `Topic ID: ${topicId}` : undefined}
    >
      {label}
    </span>
  );
};

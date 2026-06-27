import React from 'react'
import { Activity } from 'lucide-react'
import { useTranslation } from '../context'
import type { Article } from '../types'
import { CategoryBadge } from './CategoryBadge'
import { PublishedDateBadge } from './PublishedDateBadge'

interface RecentArticlesFeedProps {
  articles: Article[]
  onArticleClick: (article: Article) => void
}

export const RecentArticlesFeed: React.FC<RecentArticlesFeedProps> = ({ articles, onArticleClick }) => {
  const { t } = useTranslation()

  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-[10px] text-gray-500 font-mono uppercase font-bold tracking-wider flex items-center gap-1.5">
        <Activity className="w-3 h-3 text-cyan-400" /> {t('recentArticles')}
      </h3>
      
      <div className="bg-[#1a1a1a] overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-[#151515] text-gray-500 border-b border-[#222]">
              <th className="p-3 font-semibold">{t('published')}</th>
              <th className="p-3 font-semibold">{t('category')}</th>
              <th className="p-3 font-semibold">{t('title')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {articles.map((art, idx) => (
              <tr 
                key={idx} 
                onClick={() => onArticleClick(art)}
                className="hover:bg-[#222]/30 text-gray-300 cursor-pointer transition-colors"
              >
                <td className="p-3 whitespace-nowrap">
                  <PublishedDateBadge date={art.date} variant="small" />
                </td>
                <td className="p-3 whitespace-nowrap">
                  <CategoryBadge category={art.category} variant="small" />
                </td>
                <td className="p-3 truncate max-w-[280px] font-medium text-white font-sans">{art.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
export default RecentArticlesFeed

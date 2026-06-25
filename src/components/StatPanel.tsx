import React from 'react'
import { Database, Tag } from 'lucide-react'
import { useTranslation } from '../context'

interface StatPanelProps {
  totalArticles: number
  categoryCounts: Record<string, number>
}

export const StatPanel: React.FC<StatPanelProps> = ({ totalArticles, categoryCounts }) => {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <h3 className="text-[10px] text-gray-500 font-mono uppercase font-bold tracking-wider">
        {t('statistics')}
      </h3>

      {/* Total Articles Counter */}
      <div className="bg-[#1a1a1a] p-6 relative">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 to-indigo-500" />
        <div className="flex items-center gap-3 text-gray-400 mb-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <span className="text-xs uppercase font-mono font-bold tracking-wider">{t('totalArticles')}</span>
        </div>
        <div className="text-4xl font-extrabold text-white font-mono leading-none tracking-tight">
          {totalArticles}
        </div>
        <span className="text-[10px] text-gray-500 font-mono mt-2 block">{t('indexedRecords')}</span>
      </div>

      {/* Category Breakdown List */}
      <div className="bg-[#1a1a1a] p-6 space-y-4">
        <div className="flex items-center gap-3 text-gray-400 border-b border-[#252525] pb-2 font-sans">
          <Tag className="w-4 h-4 text-indigo-400" />
          <span className="text-xs uppercase font-mono font-bold tracking-wider">{t('categoryDist')}</span>
        </div>

        <div className="space-y-3.5">
          {Object.entries(categoryCounts).map(([cat, count]) => {
            const percentage = totalArticles > 0 ? Math.round((count / totalArticles) * 100) : 0
            return (
              <div key={cat} className="space-y-1 font-sans">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-300">{cat}</span>
                  <span className="text-gray-400 font-mono">{count} ({percentage}%)</span>
                </div>
                <div className="h-1 bg-[#252525] w-full">
                  <div 
                    style={{ width: `${percentage}%` }}
                    className="h-full bg-cyan-500/80 transition-all"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
export default StatPanel

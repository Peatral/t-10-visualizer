import React from 'react'
import { useTranslation } from '../context/LanguageContext'

interface HeatmapTableProps {
  topWords: string[]
  croppedTimeScale: { bucket: string; sortVal: number }[]
  grid: Record<string, Record<string, number>>
  translations: Record<string, string>
  maxCellCount: number
  handleCellClick: (word: string, displayLabel: string, bucket: string) => void
}

export const HeatmapTable: React.FC<HeatmapTableProps> = ({
  topWords,
  croppedTimeScale,
  grid,
  translations,
  maxCellCount,
  handleCellClick
}) => {
  const { t, language } = useTranslation()

  return (
    <div className="flex-grow overflow-auto bg-[#1e1e1e]">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 bg-[#1e1e1e] z-20 border border-[#2e2e2e] text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[200px] font-sans">
              {t('heatmapLabel')}
            </th>
            {croppedTimeScale.map(col => (
              <th key={col.bucket} className="border border-[#2e2e2e] text-center px-2 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[70px] font-sans">
                {col.bucket}
              </th>
            ))}
            <th className="border border-[#2e2e2e] text-center px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-gray-400 bg-[#252525] font-sans">
              {t('totalLabel')}
            </th>
          </tr>
        </thead>
        <tbody>
          {topWords.map(word => {
            const translation = translations[word] || ""
            const displayLabel = language === 'en' && translation ? translation : word

            let wordTotal = 0

            return (
              <tr key={word} className="hover:bg-[#252525]/30">
                <td className="sticky left-0 bg-[#1a1a1a] z-10 border border-[#2e2e2e] text-left px-4 py-2.5 text-xs font-semibold text-white font-sans max-w-[240px] truncate">
                  {displayLabel}
                </td>
                {croppedTimeScale.map(col => {
                  const count = grid[word][col.bucket] || 0
                  wordTotal += count

                  const opacity = maxCellCount > 0 ? (count / maxCellCount).toFixed(2) : "0"
                  const hasCount = count > 0

                  return (
                    <td 
                      key={col.bucket}
                      onClick={() => hasCount && handleCellClick(word, displayLabel, col.bucket)}
                      style={{ 
                        backgroundColor: hasCount ? `rgba(3, 169, 244, ${opacity})` : 'transparent' 
                      }}
                      className={`border border-[#2e2e2e] text-center text-xs font-bold font-mono transition-transform duration-75 ${
                        hasCount 
                          ? 'text-white cursor-pointer hover:scale-[1.08] hover:shadow-lg hover:z-20 hover:relative' 
                          : 'text-gray-700 bg-[#151515]/30'
                      }`}
                      title={`${count} articles containing '${displayLabel}' in ${col.bucket}`}
                    >
                      {hasCount ? count : ""}
                    </td>
                  )
                })}
                <td className="border border-[#2e2e2e] text-center text-xs font-bold font-mono text-gray-400 bg-[#1b1b1b]">
                  {wordTotal}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
export default HeatmapTable

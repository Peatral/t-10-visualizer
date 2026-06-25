import React from 'react'
import { useTranslation } from '../context/LanguageContext'

interface HeatmapTableProps {
  topWords: string[]
  croppedTimeScale: { bucket: string; sortVal: number }[]
  grid: Record<string, Record<string, number>>
  translations: Record<string, string>
  maxCellCount: number
  handleCellClick: (word: string, displayLabel: string, bucket: string) => void
  handleRowClick: (word: string, displayLabel: string) => void
  handleColumnClick: (bucket: string) => void
}

export const HeatmapTable: React.FC<HeatmapTableProps> = ({
  topWords,
  croppedTimeScale,
  grid,
  translations,
  maxCellCount,
  handleCellClick,
  handleRowClick,
  handleColumnClick
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
            {croppedTimeScale.map(col => {
              // Count total articles in this column to see if it's clickable
              let colTotal = 0
              topWords.forEach(word => {
                colTotal += grid[word]?.[col.bucket] || 0
              })

              return (
                <th 
                  key={col.bucket} 
                  onClick={() => colTotal > 0 && handleColumnClick(col.bucket)}
                  className={`border border-[#2e2e2e] text-center px-2 py-3 text-[10px] font-bold uppercase tracking-wider min-w-[70px] font-sans transition-colors ${
                    colTotal > 0 
                      ? 'text-cyan-400 cursor-pointer hover:bg-[#252525] hover:text-cyan-300' 
                      : 'text-gray-600'
                  }`}
                  title={colTotal > 0 ? `Show all ${colTotal} articles in ${col.bucket}` : undefined}
                >
                  {col.bucket}
                </th>
              )
            })}
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
            croppedTimeScale.forEach(col => {
              wordTotal += grid[word]?.[col.bucket] || 0
            })

            return (
              <tr key={word} className="hover:bg-[#252525]/30">
                <td 
                  onClick={() => wordTotal > 0 && handleRowClick(word, displayLabel)}
                  className={`sticky left-0 z-10 border border-[#2e2e2e] text-left px-4 py-2.5 text-xs font-semibold font-sans max-w-[240px] truncate transition-colors ${
                    wordTotal > 0 
                      ? 'bg-[#1a1a1a] text-[#03a9f4] cursor-pointer hover:bg-[#252525] hover:text-cyan-400' 
                      : 'bg-[#151515] text-gray-500'
                  }`}
                  title={wordTotal > 0 ? `Show all ${wordTotal} articles matching '${displayLabel}'` : undefined}
                >
                  {displayLabel}
                </td>
                {croppedTimeScale.map(col => {
                  const count = grid[word]?.[col.bucket] || 0
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
                      title={hasCount ? `${count} articles containing '${displayLabel}' in ${col.bucket}` : undefined}
                    >
                      {hasCount ? count : ""}
                    </td>
                  )
                })}
                <td 
                  onClick={() => wordTotal > 0 && handleRowClick(word, displayLabel)}
                  className={`border border-[#2e2e2e] text-center text-xs font-bold font-mono transition-colors ${
                    wordTotal > 0 
                      ? 'text-cyan-400 bg-[#1b1b1b] cursor-pointer hover:bg-[#252525] hover:text-cyan-300' 
                      : 'text-gray-600 bg-[#151515]/50'
                  }`}
                  title={wordTotal > 0 ? `Show all ${wordTotal} articles matching '${displayLabel}'` : undefined}
                >
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

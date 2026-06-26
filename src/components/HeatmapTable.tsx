import React, { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from '../context'

interface HeatmapTableProps {
  topWords: string[]
  croppedTimeScale: { bucket: string; sortVal: number; isGap?: boolean; gapStart?: string; gapEnd?: string; spanCount?: number }[]
  grid: Record<string, Record<string, number>>
  displayGrid?: Record<string, Record<string, string | number>> // optional formatted string or relative fraction
  weightGrid?: Record<string, Record<string, number>> // raw weights for relative mode color density styling
  topicKeywords?: Record<string, string[]>
  labelToDisplay?: Record<string, string>
  maxCellCount: number
  maxDisplayWeight?: number // max value for relative density styling
  handleCellClick: (word: string, displayLabel: string, bucket: string) => void
  handleRowClick: (word: string, displayLabel: string) => void
  handleColumnClick: (bucket: string) => void
}

export const HeatmapTable: React.FC<HeatmapTableProps> = ({
  topWords,
  croppedTimeScale,
  grid,
  displayGrid,
  weightGrid,
  topicKeywords,
  labelToDisplay,
  maxCellCount,
  maxDisplayWeight,
  handleCellClick,
  handleRowClick,
  handleColumnClick
}) => {
  const { t } = useTranslation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Set up row virtualization
  const rowVirtualizer = useVirtualizer({
    count: topWords.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 38, // Estimated height of each table row (py-2.5 + borders + text)
    overscan: 15,
  })

  // Fixed widths for grid alignment in flex layout
  const labelColWidth = 'w-[180px]'
  const dataColWidth = 'w-[72px]'

  return (
    <div ref={scrollContainerRef} className="flex-grow overflow-auto bg-[#1e1e1e] relative">
      <table className="w-full min-w-max border-collapse block">
        <thead className="block sticky top-0 z-30 bg-[#1e1e1e] w-full min-w-max">
          <tr className="flex w-full min-w-max">
            <th className={`sticky left-0 bg-[#1e1e1e] z-20 border border-[#2e2e2e] text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap font-sans ${labelColWidth} shrink-0 flex items-center`}>
              {t('heatmapLabel')}
            </th>
            {croppedTimeScale.map(col => {
              if (col.isGap) {
                return (
                  <th
                    key={col.bucket}
                    className={`border border-[#2e2e2e] text-center px-1 py-2 text-[9px] font-medium tracking-wide text-gray-505 bg-[#171717] ${dataColWidth} shrink-0 flex items-center justify-center font-mono leading-tight select-none text-gray-550`}
                    title={`Gap of ${col.spanCount} empty slots`}
                  >
                    <div className="flex flex-col items-center">
                      <span>{col.gapStart}</span>
                      <span className="text-[8px] opacity-60">...</span>
                      <span>{col.gapEnd}</span>
                    </div>
                  </th>
                )
              }

              // Count total articles in this column to see if it's clickable
              let colTotal = 0
              topWords.forEach(word => {
                colTotal += grid[word]?.[col.bucket] || 0
              })

              return (
                <th 
                   key={col.bucket} 
                   onClick={() => colTotal > 0 && handleColumnClick(col.bucket)}
                   className={`border border-[#2e2e2e] text-center px-2 py-3 text-[10px] font-bold uppercase tracking-wider ${dataColWidth} shrink-0 flex items-center justify-center font-sans transition-colors ${
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
            <th className={`border border-[#2e2e2e] text-center px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-gray-400 bg-[#252525] font-sans ${dataColWidth} shrink-0 flex items-center justify-center`}>
              {t('totalLabel')}
            </th>
          </tr>
        </thead>
        <tbody
          className="block relative w-full min-w-max"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const word = topWords[virtualRow.index]
            if (!word) return null

            const keywords = topicKeywords?.[word] || []
            const displayLabel = labelToDisplay?.[word] || (() => {
              const firstKeyword = keywords[0] || word
              return firstKeyword.length <= 3 
                ? firstKeyword.toUpperCase() 
                : (firstKeyword.charAt(0).toUpperCase() + firstKeyword.slice(1))
            })()

            let wordTotal = 0
            croppedTimeScale.forEach(col => {
              if (!col.isGap) {
                wordTotal += grid[word]?.[col.bucket] || 0
              }
            })

            const keywordsTooltip = keywords.length > 0 ? `Keywords: ${keywords.join(', ')}` : ''

            return (
              <tr 
                key={word} 
                className="flex absolute top-0 left-0 w-full min-w-max hover:bg-[#252525]/30"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <td 
                  onClick={() => wordTotal > 0 && handleRowClick(word, displayLabel)}
                  className={`sticky left-0 z-10 border border-[#2e2e2e] text-left px-4 py-2.5 text-xs font-semibold font-sans whitespace-nowrap transition-colors ${labelColWidth} shrink-0 flex items-center ${
                    wordTotal > 0 
                      ? 'bg-[#1a1a1a] text-[#03a9f4] cursor-pointer hover:bg-[#252525] hover:text-cyan-400' 
                      : 'bg-[#151515] text-gray-500'
                  }`}
                  title={`${keywordsTooltip}${wordTotal > 0 ? ` | Click to show all ${wordTotal} articles` : ''}`}
                >
                  <span className="truncate">{displayLabel}</span>
                </td>
                {croppedTimeScale.map(col => {
                  if (col.isGap) {
                    return (
                      <td
                        key={col.bucket}
                        className={`border border-[#2e2e2e] select-none ${dataColWidth} shrink-0 flex items-center justify-center`}
                        style={{
                          background: 'repeating-linear-gradient(45deg, #171717, #171717 6px, #262626 6px, #262626 12px)'
                        }}
                      />
                    )
                  }

                  const count = grid[word]?.[col.bucket] || 0
                  const hasCount = count > 0
                  
                  // Use displayGrid for value styling if present
                  const displayValue = displayGrid ? (displayGrid[word]?.[col.bucket] ?? "") : (hasCount ? count : "")
                  
                  // Calculate opacity based on weight metric
                  let opacity = "0"
                  if (displayGrid && maxDisplayWeight && maxDisplayWeight > 0) {
                    // Look up weight value from relativeWeights / displayGrid source values directly
                    const rawVal = weightGrid && weightGrid[word] ? (weightGrid[word][col.bucket] || 0) : 0
                    opacity = (rawVal / maxDisplayWeight).toFixed(2)
                  } else if (maxCellCount > 0) {
                    opacity = (count / maxCellCount).toFixed(2)
                  }

                  return (
                    <td 
                      key={col.bucket}
                      onClick={() => hasCount && handleCellClick(word, displayLabel, col.bucket)}
                      style={{ 
                        backgroundColor: hasCount ? `rgba(3, 169, 244, ${opacity})` : 'transparent' 
                      }}
                      className={`border border-[#2e2e2e] text-center text-xs font-bold font-mono transition-all duration-75 ${dataColWidth} shrink-0 flex items-center justify-center ${
                        hasCount 
                          ? 'text-white cursor-pointer hover:scale-[1.08] hover:shadow-lg hover:z-20 hover:relative' 
                          : 'text-gray-700 bg-[#151515]/30'
                      }`}
                      title={hasCount ? `${count} articles containing '${displayLabel}' in ${col.bucket}` : undefined}
                    >
                      {displayValue}
                    </td>
                  )
                })}
                <td 
                  onClick={() => wordTotal > 0 && handleRowClick(word, displayLabel)}
                  className={`border border-[#2e2e2e] text-center text-xs font-bold font-mono transition-colors ${dataColWidth} shrink-0 flex items-center justify-center ${
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

// Helper to format date into Year-Half (e.g. 2021-H1)
export function getYearHalf(dateStr: string): { bucket: string; sortVal: number } {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return { bucket: 'Unknown', sortVal: 0 }
  const year = d.getFullYear()
  const half = d.getMonth() < 6 ? "H1" : "H2"
  return {
    bucket: `${year}-${half}`,
    sortVal: year * 2 + (half === "H1" ? 0 : 1)
  }
}

// Global cache for compiled regular expressions to avoid recompilation inside hot loops
const regexCache = new Map<string, RegExp>()

// Check if a word matches text using unicode-aware boundaries
export function checkSingleMatch(text: string, keyword: string): boolean {
  const lowerWord = keyword.toLowerCase()
  let regex = regexCache.get(lowerWord)
  
  if (!regex) {
    const escaped = lowerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    regex = new RegExp(`(?<![a-zA-Z0-9äöüÄÖÜß])${escaped}(?![a-zA-Z0-9äöüÄÖÜß])`, "i")
    regexCache.set(lowerWord, regex)
  }
  
  return regex.test(text)
}

// Check bilingual keyword occurrence (German word or its English translation)
export function checkKeywordMatchBilingual(text: string, germanWord: string, englishWord: string): boolean {
  if (checkSingleMatch(text, germanWord)) return true
  if (englishWord && checkSingleMatch(text, englishWord)) return true
  return false
}

export interface TrendmapPayload {
  themenwolkeWords: Record<string, string[]>
  translations: Record<string, string>
}

export interface DataPayload {
  totalArticlesCount: number
  categories: string[]
}


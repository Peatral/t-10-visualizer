export interface Article {
  id: string
  title: string
  description: string
  date: string
  link: string
  category: string
}

export interface ArticleDetail extends Article {
  bodyText: string
}

export interface TrendmapPayload {
  themenwolkeWords: Record<string, string[]>
  translations: Record<string, string>
}

export interface DataPayload {
  totalArticlesCount: number
  categories: string[]
}


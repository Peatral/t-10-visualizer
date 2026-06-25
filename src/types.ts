export interface Article {
  title: string
  description: string
  bodyText: string
  date: string
  link: string
  category: string
}

export interface DataPayload {
  articles: Article[]
  themenwolkeWords: Record<string, string[]>
  translations: Record<string, string>
}

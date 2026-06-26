import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { db } from './index.js'
import { articles, topics, topicKeywords, articleTopicMatches, categories, topicsToCategories } from './schema.js'
import { getYearHalf } from '../../utils/matching.js'
import { TOPICS_LIST } from './topicData.js'

type NewArticle = typeof articles.$inferInsert

function getSafeFilename(url: string): string {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i)
    hash |= 0
  }
  const cleanUrl = url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9-]/g, '_')
    .slice(0, 50)
  return `${cleanUrl}_${Math.abs(hash)}`
}

function getSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function detectArticleLanguage(link: string, title: string, bodyText: string): 'de' | 'en' {
  const url = link.toLowerCase()
  if (url.includes('.de') || url.includes('golem') || url.includes('heise') || url.includes('spiegel') || url.includes('zeit') || url.includes('welt.de') || url.includes('faz.net')) {
    return 'de'
  }
  const deWords = ['der', 'die', 'das', 'ist', 'und', 'in', 'mit', 'für', 'von', 'eine', 'ein', 'zu', 'den', 'dem']
  const enWords = ['the', 'is', 'and', 'in', 'with', 'for', 'of', 'a', 'an', 'to', 'on', 'at', 'that', 'this']
  
  const text = (title + ' ' + bodyText).toLowerCase()
  let deCount = 0
  let enCount = 0
  
  deWords.forEach(w => {
    const regex = new RegExp(`\\b${w}\\b`)
    if (regex.test(text)) deCount++
  })
  enWords.forEach(w => {
    const regex = new RegExp(`\\b${w}\\b`)
    if (regex.test(text)) enCount++
  })
  
  return deCount > enCount ? 'de' : 'en'
}

async function seed() {
  console.log('Starting SQLite seeding with topics-based schemas...')

  const publicDir = path.resolve(process.cwd(), 'public')
  const articlesJsonPath = path.join(publicDir, 'articles.json')
  const articlesDir = path.join(publicDir, 'articles')

  // Create tables and FTS5 virtual table
  const dbPath = path.resolve(process.cwd(), 'sqlite.db')
  const sqlite = new Database(dbPath)
  
  console.log('Creating tables, triggers, and FTS5 virtual tables...')
  sqlite.exec(`
    DROP TABLE IF EXISTS article_topic_matches;
    DROP TABLE IF EXISTS topics_to_categories;
    DROP TABLE IF EXISTS topic_keywords;
    DROP TABLE IF EXISTS topics;
    DROP TABLE IF EXISTS article_keyword_matches;
    DROP TABLE IF EXISTS themenwolke;
    DROP TABLE IF EXISTS translations;
    DROP TRIGGER IF EXISTS articles_ai;
    DROP TRIGGER IF EXISTS articles_ad;
    DROP TRIGGER IF EXISTS articles_au;
    DROP TABLE IF EXISTS articles_fts;
    DROP TABLE IF EXISTS articles;
    DROP TABLE IF EXISTS categories;

    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      link TEXT NOT NULL,
      category_id TEXT,
      category TEXT NOT NULL,
      body_text TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      name_de TEXT NOT NULL,
      name_en TEXT NOT NULL
    );

    CREATE TABLE topics_to_categories (
      topic_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      PRIMARY KEY(topic_id, category_id),
      FOREIGN KEY(topic_id) REFERENCES topics(id),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE topic_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      language TEXT NOT NULL,
      FOREIGN KEY(topic_id) REFERENCES topics(id)
    );

    CREATE TABLE article_topic_matches (
      article_id TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      bucket TEXT NOT NULL,
      sort_val INTEGER NOT NULL,
      topic_id TEXT NOT NULL,
      FOREIGN KEY(topic_id) REFERENCES topics(id),
      FOREIGN KEY(article_id) REFERENCES articles(id)
    );
    
    CREATE INDEX idx_category_id ON articles(category_id);
    CREATE INDEX idx_date ON articles(date);
    CREATE INDEX idx_topic_cat_topic ON topics_to_categories(topic_id);
    CREATE INDEX idx_topic_cat_cat ON topics_to_categories(category_id);
    CREATE INDEX idx_keywords_topic ON topic_keywords(topic_id);
    CREATE INDEX idx_matches_category ON article_topic_matches(category);
    CREATE INDEX idx_matches_topic ON article_topic_matches(topic_id);

    -- FTS5 Virtual Table for full-text search
    CREATE VIRTUAL TABLE articles_fts USING fts5(
      id UNINDEXED,
      title,
      description,
      body_text
    );

    -- Triggers to keep FTS5 virtual table in sync with articles
    CREATE TRIGGER articles_ai AFTER INSERT ON articles BEGIN
      INSERT INTO articles_fts(id, title, description, body_text)
      VALUES (new.id, new.title, new.description, new.body_text);
    END;

    CREATE TRIGGER articles_ad AFTER DELETE ON articles BEGIN
      DELETE FROM articles_fts WHERE id = old.id;
    END;

    CREATE TRIGGER articles_au AFTER UPDATE ON articles BEGIN
      DELETE FROM articles_fts WHERE id = old.id;
      INSERT INTO articles_fts(id, title, description, body_text)
      VALUES (new.id, new.title, new.description, new.body_text);
    END;
  `)

  // 1. Seed categories first to satisfy Foreign Key constraints for topics_to_categories junction
  let rawArticles: any[] = []
  if (fs.existsSync(articlesJsonPath)) {
    console.log('Seeding categories...')
    rawArticles = JSON.parse(fs.readFileSync(articlesJsonPath, 'utf8'))
    const uniqueCategoryNames: string[] = Array.from(new Set(rawArticles.map((art: any) => art.category)))
    const categoryEntries = uniqueCategoryNames.map(name => ({
      id: getSlug(name),
      name: name
    }))
    await db.insert(categories).values(categoryEntries).run()
    console.log(`Seeded ${categoryEntries.length} unique categories.`)
  }

  // 2. Seed topics from TOPICS_LIST
  const topicsMap = new Map<string, { 
    id: string, 
    nameDe: string, 
    nameEn: string, 
    categories: Set<string>, 
    keywordsDe: Set<string>, 
    keywordsEn: Set<string> 
  }>()

  for (const topic of TOPICS_LIST) {
    topicsMap.set(topic.id, {
      id: topic.id,
      nameDe: topic.nameDe,
      nameEn: topic.nameEn,
      categories: new Set(topic.categories),
      keywordsDe: new Set(topic.keywordsDe),
      keywordsEn: new Set(topic.keywordsEn)
    })
  }

  const topicsEntries: any[] = []
  const keywordsEntries: any[] = []
  const topicsToCategoriesEntries: any[] = []

  for (const topic of TOPICS_LIST) {
    topicsEntries.push({
      id: topic.id,
      nameDe: topic.nameDe,
      nameEn: topic.nameEn,
    })

    for (const kw of topic.keywordsDe) {
      keywordsEntries.push({
        topicId: topic.id,
        keyword: kw,
        language: 'de',
      })
    }

    for (const kw of topic.keywordsEn) {
      keywordsEntries.push({
        topicId: topic.id,
        keyword: kw,
        language: 'en',
      })
    }

    for (const catId of topic.categories) {
      topicsToCategoriesEntries.push({
        topicId: topic.id,
        categoryId: catId,
      })
    }
  }

  if (topicsEntries.length > 0) {
    await db.insert(topics).values(topicsEntries).run()
  }
  if (keywordsEntries.length > 0) {
    await db.insert(topicKeywords).values(keywordsEntries).run()
  }
  if (topicsToCategoriesEntries.length > 0) {
    await db.insert(topicsToCategories).values(topicsToCategoriesEntries).run()
  }
  console.log(`Seeded ${topicsEntries.length} topics, ${keywordsEntries.length} topic keywords, and ${topicsToCategoriesEntries.length} topic-category links.`)

  // 3. Seed articles
  if (rawArticles.length > 0) {
    console.log('Seeding articles...')
    let count = 0
    const batchSize = 100
    let currentBatch: Array<NewArticle> = []

    for (const art of rawArticles) {
      const filename = `${getSafeFilename(art.id)}.json`
      const detailPath = path.join(articlesDir, filename)
      let bodyText = ''
      
      if (fs.existsSync(detailPath)) {
        try {
          const detail = JSON.parse(fs.readFileSync(detailPath, 'utf8'))
          bodyText = detail.bodyText || ''
        } catch {
          console.warn(`Failed to parse article detail for ${art.id}`)
        }
      }

      const lang = detectArticleLanguage(art.link, art.title, bodyText)

      currentBatch.push({
        id: art.id,
        title: art.title,
        description: art.description,
        date: art.date,
        link: art.link,
        categoryId: getSlug(art.category),
        category: art.category,
        bodyText: bodyText,
        language: lang
      })

      if (currentBatch.length >= batchSize) {
        await db.insert(articles).values(currentBatch).run()
        count += currentBatch.length
        currentBatch = []
      }
    }

    if (currentBatch.length > 0) {
      await db.insert(articles).values(currentBatch).run()
      count += currentBatch.length
    }

    console.log('Matching articles with topics using exact word boundaries and language mapping...')
    
    const dbArticles = await db.select({
      id: articles.id,
      category: articles.category,
      date: articles.date,
      title: articles.title,
      description: articles.description,
      bodyText: articles.bodyText,
      language: articles.language
    }).from(articles).all()

    const regexCache = new Map<string, RegExp>()
    function checkSingleMatch(text: string, keyword: string): boolean {
      const lowerWord = keyword.toLowerCase()
      let regex = regexCache.get(lowerWord)
      if (!regex) {
        const escaped = lowerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        regex = new RegExp(`(?<![a-zA-Z0-9äöüÄÖÜß])${escaped}(?![a-zA-Z0-9äöüÄÖÜß])`, "i")
        regexCache.set(lowerWord, regex)
      }
      return regex.test(text)
    }

    const matchEntries: any[] = []

    for (const art of dbArticles) {
      const { bucket, sortVal } = getYearHalf(art.date)
      const combinedText = `${art.title} ${art.description} ${art.bodyText}`

      for (const topic of topicsMap.values()) {
        const artCatId = getSlug(art.category)

        if (topic.categories.has(artCatId)) {
          let isMatch = false
          // Only check keywords that match the language of the article!
          const targetKeywords = art.language === 'de' ? topic.keywordsDe : topic.keywordsEn
          
          for (const kw of targetKeywords) {
            if (checkSingleMatch(combinedText, kw)) {
              isMatch = true
              break
            }
          }

          if (isMatch) {
            matchEntries.push({
              articleId: art.id,
              category: art.category,
              date: art.date,
              bucket,
              sortVal,
              topicId: topic.id,
            })
          }
        }
      }
    }

    const matchBatchSize = 500
    for (let i = 0; i < matchEntries.length; i += matchBatchSize) {
      const batch = matchEntries.slice(i, i + matchBatchSize)
      await db.insert(articleTopicMatches).values(batch).run()
    }
    console.log(`Successfully populated article_topic_matches with ${matchEntries.length} matches.`)
  }

  console.log('Seeding complete.')
}

seed().catch(err => {
  console.error('Seeding failed:', err)
  process.exit(1)
})

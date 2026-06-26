import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { db } from './index.js'
import { articles, themenwolke, translations, categories, trendmapCache } from './schema.js'
import { calculateTrendmapGrid } from '../../utils/trendmapCalc.js'
import { eq, and } from 'drizzle-orm'

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

async function seed() {
  console.log('Starting SQLite seeding with relational schemas and database view...')

  const publicDir = path.resolve(process.cwd(), 'public')
  const articlesJsonPath = path.join(publicDir, 'articles.json')
  const trendmapJsonPath = path.join(publicDir, 'trendmap.json')
  const articlesDir = path.join(publicDir, 'articles')

  // Create tables and FTS5 virtual table
  const dbPath = path.resolve(process.cwd(), 'sqlite.db')
  const sqlite = new Database(dbPath)
  
  console.log('Creating tables, triggers, and FTS5 virtual tables...')
  sqlite.exec(`
    DROP TABLE IF EXISTS trendmap_cache;
    DROP TABLE IF EXISTS article_keyword_matches;
    DROP TRIGGER IF EXISTS articles_ai;
    DROP TRIGGER IF EXISTS articles_ad;
    DROP TRIGGER IF EXISTS articles_au;
    DROP TABLE IF EXISTS articles_fts;
    DROP TABLE IF EXISTS articles;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS themenwolke;
    DROP TABLE IF EXISTS translations;

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
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE themenwolke (
      category TEXT NOT NULL,
      word TEXT NOT NULL
    );

    CREATE TABLE translations (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE trendmap_cache (
      category TEXT NOT NULL,
      language TEXT NOT NULL,
      result_json TEXT NOT NULL
    );

    CREATE TABLE article_keyword_matches (
      article_id TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      bucket TEXT NOT NULL,
      sort_val INTEGER NOT NULL,
      german_word TEXT NOT NULL,
      english_word TEXT NOT NULL
    );
    
    CREATE INDEX idx_category_id ON articles(category_id);
    CREATE INDEX idx_date ON articles(date);
    CREATE INDEX idx_matches_category ON article_keyword_matches(category);
    CREATE INDEX idx_themenwolke_category ON themenwolke(category);
    CREATE INDEX idx_cache_lookup ON trendmap_cache(category, language);

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

  // 1. Seed translations & themenwolke from trendmap.json
  if (fs.existsSync(trendmapJsonPath)) {
    console.log('Seeding translations and themenwolke...')
    const trendmapData = JSON.parse(fs.readFileSync(trendmapJsonPath, 'utf8'))
    
    // Seed translations
    const translationEntries = Object.entries(trendmapData.translations || {}).map(([key, value]) => ({
      key,
      value: String(value)
    }))
    if (translationEntries.length > 0) {
      await db.insert(translations).values(translationEntries).run()
    }

    // Seed themenwolke
    const themenwolkeEntries: Array<{ category: string; word: string }> = []
    Object.entries(trendmapData.themenwolkeWords || {}).forEach(([cat, words]) => {
      if (Array.isArray(words)) {
        words.forEach(word => {
          themenwolkeEntries.push({ category: cat, word: String(word) })
        });
      }
    })
    if (themenwolkeEntries.length > 0) {
      await db.insert(themenwolke).values(themenwolkeEntries).run()
    }
  }

  // 2. Seed articles and categories
  if (fs.existsSync(articlesJsonPath)) {
    console.log('Seeding categories and articles...')
    interface RawArticleInput {
      id: string
      title: string
      description: string
      date: string
      link: string
      category: string
    }
    const rawArticles = JSON.parse(fs.readFileSync(articlesJsonPath, 'utf8')) as RawArticleInput[]
    
    // Extract unique categories and seed them
    const uniqueCategoryNames: string[] = Array.from(new Set(rawArticles.map((art) => art.category)))
    const categoryEntries = uniqueCategoryNames.map(name => ({
      id: getSlug(name),
      name: name
    }))
    await db.insert(categories).values(categoryEntries).run()
    console.log(`Seeded ${categoryEntries.length} unique categories.`)

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

      currentBatch.push({
        id: art.id,
        title: art.title,
        description: art.description,
        date: art.date,
        link: art.link,
        categoryId: getSlug(art.category),
        category: art.category,
        bodyText: bodyText
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

    console.log('Populating article_keyword_matches table using SQL join matching...')
    sqlite.exec(`
      INSERT INTO article_keyword_matches (article_id, category, date, bucket, sort_val, german_word, english_word)
      SELECT
        a.id AS article_id,
        a.category AS category,
        a.date AS date,
        (substr(a.date, 1, 4) || '-' || (CASE WHEN substr(a.date, 6, 2) < '07' THEN 'H1' ELSE 'H2' END)) AS bucket,
        (cast(substr(a.date, 1, 4) as integer) * 2 + (CASE WHEN substr(a.date, 6, 2) < '07' THEN 0 ELSE 1 END)) AS sort_val,
        t.word AS german_word,
        coalesce(tr.value, t.word) AS english_word
      FROM articles a
      JOIN themenwolke t ON (a.category LIKE '%' || t.category || '%')
      LEFT JOIN translations tr ON t.word = tr.key
      WHERE instr(lower(a.title || ' ' || a.description || ' ' || a.body_text), lower(t.word)) > 0
         OR (tr.value IS NOT NULL AND instr(lower(a.title || ' ' || a.description || ' ' || a.body_text), lower(tr.value)) > 0)
    `)
    console.log('Populated article_keyword_matches successfully.')

    console.log('Pre-populating trendmapCache table for all categories and languages...')
    const languages: Array<'en' | 'de'> = ['en', 'de']
    for (const cat of uniqueCategoryNames) {
      for (const lang of languages) {
        console.log(`Precomputing trendmap grid cache for: "${cat}" [${lang}]...`)
        try {
          const result = await calculateTrendmapGrid(db, cat, lang)
          await db.delete(trendmapCache)
            .where(and(eq(trendmapCache.category, cat), eq(trendmapCache.language, lang)))
            .run()
          await db.insert(trendmapCache)
            .values({
              category: cat,
              language: lang,
              resultJson: JSON.stringify(result),
            })
            .run()
        } catch (cacheErr) {
          console.error(`Failed to precompute cache for "${cat}" [${lang}]:`, cacheErr)
        }
      }
    }
    console.log('Trendmap cache pre-population complete.')

    sqlite.close()
    console.log('Seeding complete.')
  }
}

seed().catch(err => {
  console.error('Seeding failed:', err)
  process.exit(1)
})

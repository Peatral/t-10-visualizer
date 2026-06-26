# Mega Visualizer

A high-performance React + TypeScript single-page application for analyzing and visualizing serious games research data, category timelines, and keyword trend maps. 

---

## 🏗️ Architecture Overview

The project is structured as a fullstack-capable Vite application:
- **Frontend**: Built with **React 19**, **TypeScript**, and styled with custom CSS.
- **Routing**: Client-side routing managed by **TanStack Router**.
- **Data Fetching**: Fully type-safe remote procedure calls (RPC) powered by **tRPC** and **TanStack Query** (React Query).
- **Backend/API**: Exposes serverless functions under `api/trpc.ts` matching Vercel Serverless requirements.
- **Database**: File-based **SQLite** (`sqlite.db`) queried using **Drizzle ORM**.

---

## 🗄️ Database & Schema Design

The SQLite database is structured for maximum retrieval speed, full-text search capability, and serverless compatibility:

1. **`categories`**: Stores article categories (e.g. Energy, Food, Housing, Mobility).
2. **`articles`**: Contains article metadata (title, description, publication date, external link, category, and full text).
3. **`themenwolke`**: Vocabulary words categorized for matching, indexed on `category` for fast lookup.
4. **`translations`**: Key-value pairs for translations to support bilingual toggling.
5. **`article_keyword_matches`**: A physical junction table pre-calculated and populated at seed time. This avoids expensive runtime string-matching queries or complex virtual view scans.
6. **`trendmap_cache`**: Pre-calculated Trendmap grid structures serialized as JSON to enable instant responses (1-2ms).
7. **`articles_fts`**: An SQLite **FTS5** virtual full-text search table kept in sync with the `articles` table via triggers (`articles_ai`, `articles_ad`, `articles_au`).

---

## ⚡ Serverless & Vercel Optimizations

Running a file-based database like SQLite on serverless functions requires strict constraints, which are fully handled in this project:

- **Read-Only File System Handling**: Vercel Serverless Functions execute on a read-only filesystem. The database connection ([db/index.ts](file:///home/chris/Documents/serious-games/mega-visualizer/src/server/db/index.ts)) detects this environment and opens the SQLite database in **read-only mode** (`{ readonly: true }`) to prevent permission errors.
- **Precomputed Trendmap Caching**: Since writes are prohibited in production, the seeding script pre-populates all Trendmap category/language grids into the `trendmap_cache` table. The tRPC router serves these grids directly from the cache.
- **Minimal Response Payloads**: To reduce bandwidth and parsing overhead, the server returns only arrays of **article IDs** in grid cell matches instead of duplicating entire article metadata objects. The React client constructs an in-memory lookup map to resolve article objects instantly on demand.
- **ESM & Node16 Support**: All relative imports on the server side use explicit `.js` extensions as required by Node16/NodeNext resolution on Vercel.

---

## 🔄 Data Ingestion & Scrape Pipeline

The project uses Deno-based scripts in the workspace root to ingest and process articles:

1. **Scraping (`scraper.ts`)**:
   - Parses Linklists (RTF or HTML files) located in `/linklists`.
   - Attempts direct retrieval, falling back to the **Wayback Machine API** for offline or archived sources.
   - Automatically bypasses cookie consent banners (e.g., Golem.de) using browser automation.
   - Skips pages already successfully scraped to minimize network overhead.
2. **Metadata Extraction (`metadata_extractor.ts`)**:
   - Parses the scraped documents (`ld+json`, meta tags, DOM structures, and PDF descriptors).
   - Extracts authors, descriptions, sites, languages, and publication dates.
   - **Important**: Prioritizes `YYYY-MM-DD` dates directly embedded in article URLs, as they represent the original publication timeline reliably.
3. **Data Preparation (`prepare_data.ts`)**:
   - Validates data, matches texts, and packages them into split chunk files (`articles.json`, `trendmap.json`, etc.) ready for the public distribution folder.
4. **Seeding (`seed.ts`)**:
   - Recreates the SQLite schemas, registers FTS5 triggers, runs fast SQLite `instr()` joins to populate matches, and precomputes the Trendmap cache.

---

## 🛠️ Development & Commands

### Prerequisites
- [PNPM](https://pnpm.io/) for node dependencies.
- [Deno](https://deno.land/) for the ingestion scripts.

### Seeding the Database
To reset schemas, parse scraped data, populate keyword matches, and generate the cache:
```bash
pnpm run seed
```

### Running Locally
To launch the Vite development server (mapped to `127.0.0.1:3000` via proxy to avoid IPv6 loopback timeouts):
```bash
pnpm run dev
```

### Compiling and Linting
Before deploying, verify TypeScript compilation and formatting rules:
```bash
pnpm run build
pnpm run lint
```

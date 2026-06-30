import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router'

import { LanguageProvider } from '../context'
import Navbar from '../components/Navbar'

import appCss from '../index.css?url'

import React, { Suspense, lazy } from 'react'

// Only load the devtools component in development and in the browser
const Devtools = process.env.NODE_ENV === 'production'
  ? () => null
  : lazy(() =>
      typeof window !== 'undefined'
        ? import('../components/Devtools')
        : Promise.resolve({ default: () => null })
    )

export const Route = createRootRouteWithContext()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'T-10 Explorer',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
    scripts: [
      (import.meta.env.DEV ? {
        src: 'https://unpkg.com/react-scan/dist/auto.global.js',
        async: true,
      } : undefined)
    ]
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>T-10 Mega Visualizer</title>
        <HeadContent />
      </head>
      <body>
        <LanguageProvider>
          <div className="h-full w-full flex flex-col bg-[#121212] text-[#e0e0e0]">
            <Navbar />
            <main className="grow overflow-hidden relative">
              { children }
            </main>
          </div>
        </LanguageProvider>
        <Suspense>
          <Devtools />
        </Suspense>
        <Scripts />
      </body>
    </html>
  )
}

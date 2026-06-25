import { useState, useEffect } from 'react'
import { RouterProvider } from '@tanstack/react-router'
import type { DataPayload } from './types'
import { DataContext } from './context/DataContext'
import { LanguageProvider } from './context/LanguageContext'
import { router } from './routes'

export default function App() {
  const [data, setData] = useState<DataPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/data.json')
      .then(res => {
        if (!res.ok) throw new Error("Could not fetch bundled data.json file.")
        return res.json()
      })
      .then(setData)
      .catch(err => {
        console.error(err)
        setError(err.message)
      })
  }, [])

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#121212] text-[#e0e0e0] p-6 text-center">
        <div className="bg-red-950/20 border border-red-800 p-6 rounded-lg max-w-md">
          <h3 className="text-red-400 font-bold text-lg mb-2">Failed to Load Visualizer Data</h3>
          <p className="text-sm text-gray-400 mb-4">{error}</p>
          <div className="text-xs text-gray-500 leading-relaxed">
            Ensure that Deno has built the bundled <code className="text-gray-300">mega-visualizer/public/data.json</code> file by running the data preparation script.
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#121212] text-[#e0e0e0] gap-4">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wider uppercase text-gray-500 animate-pulse">Loading Visualizer...</span>
      </div>
    )
  }

  return (
    <DataContext.Provider value={data}>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </DataContext.Provider>
  )
}

import React from 'react'
import type { DataPayload } from '../types'

export const DataContext = React.createContext<DataPayload | null>(null)

export const useData = () => {
  const context = React.useContext(DataContext)
  if (context === null) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}

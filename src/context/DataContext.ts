import React from 'react'
import type { DataPayload } from '../types'

export const DataContext = React.createContext<DataPayload | null>(null)

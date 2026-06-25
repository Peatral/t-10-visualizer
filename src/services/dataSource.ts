import type { DataPayload } from '../types'

/**
 * Service to retrieve the application data payload.
 * Abstracting this method makes it easy to switch the data source later
 * (e.g. migrating from a static JSON file to a REST API, GraphQL, or local mock data).
 */
export async function fetchDataPayload(): Promise<DataPayload> {
  const response = await fetch('/data.json')
  
  if (!response.ok) {
    throw new Error(`Failed to load data source: ${response.status} ${response.statusText}`)
  }
  
  const data: DataPayload = await response.ok ? await response.json() : null
  
  if (!data) {
    throw new Error('Retrieved data payload is empty or invalid.')
  }
  
  return data
}

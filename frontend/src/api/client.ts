import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; errors?: string[] } | undefined
    if (data?.error) return data.error
    if (data?.errors?.length) return data.errors.join(', ')
    if (error.code === 'ECONNABORTED') return 'The request timed out.'
    if (!error.response) return `Cannot reach backend at ${API_BASE_URL}`
    return `Request failed with status code ${error.response.status}`
  }
  return error instanceof Error ? error.message : 'Unexpected error'
}

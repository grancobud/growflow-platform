import { QueryClient } from '@tanstack/react-query'

/**
 * QueryClient global para GrowFlow.
 * - staleTime 30s: data "fresca" por 30s, evita refetches innecesarios al navegar
 * - gcTime 5min: cache entries viven 5min antes de GC
 * - refetchOnWindowFocus false: el usuario decide cuando sincronizar
 * - retry 2: reintentos leves en caso de errores de red
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
    mutations: {
      retry: 1,
    },
  },
})

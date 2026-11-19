import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import type { Score } from '@/music/model'
import { scoresApi } from './scoresApi'

export const scoreKeys = {
  all: ['scores'] as const,
  detail: (id: string) => ['scores', id] as const,
}

export function useScoresList() {
  return useQuery({ queryKey: scoreKeys.all, queryFn: scoresApi.list })
}

export function useScore(id: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: () => scoreKeys.detail(toValue(id)),
    queryFn: () => scoresApi.get(toValue(id)),
    // l'éditeur garde sa propre copie de travail : pas de rechargement intempestif
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function useSaveScore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (score: Score) => scoresApi.save(score),
    onSuccess: (saved) => {
      qc.setQueryData(scoreKeys.detail(saved.id), saved)
      qc.invalidateQueries({ queryKey: scoreKeys.all, exact: true })
    },
  })
}

export function useRemoveScore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => scoresApi.remove(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: scoreKeys.detail(id) })
      qc.invalidateQueries({ queryKey: scoreKeys.all, exact: true })
    },
  })
}

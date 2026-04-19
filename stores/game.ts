import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GamePhase, Judgment, JudgmentResult, Chart } from '../types'

export const useGameStore = defineStore('game', () => {
  const phase = ref<GamePhase>('idle')
  const score = ref(0)
  const combo = ref(0)
  const maxCombo = ref(0)
  const judgments = ref<Record<Judgment, number>>({ perfect: 0, great: 0, good: 0, miss: 0 })
  const songTime = ref(0)
  const currentChart = ref<Chart | null>(null)
  const judgmentHistory = ref<JudgmentResult[]>([])
  const countdownValue = ref(0)

  const totalNotes = computed(() => currentChart.value?.notes.length ?? 0)
  const grade = computed(() => {
    const total = totalNotes.value
    if (total === 0) return 'D'
    const maxScore = total * 300
    const ratio = score.value / maxScore
    if (ratio >= 0.95) return 'S'
    if (ratio >= 0.85) return 'A'
    if (ratio >= 0.70) return 'B'
    if (ratio >= 0.50) return 'C'
    return 'D'
  })

  function setPhase(p: GamePhase) { phase.value = p }
  function addScore(points: number) { score.value += points }
  function incrementCombo() {
    combo.value++
    if (combo.value > maxCombo.value) maxCombo.value = combo.value
  }
  function resetCombo() { combo.value = 0 }
  function addJudgment(j: Judgment) { judgments.value[j]++ }
  function addJudgmentHistory(result: JudgmentResult) { judgmentHistory.value.push(result) }
  function setSongTime(t: number) { songTime.value = t }
  function setChart(chart: Chart) { currentChart.value = chart }
  function setCountdown(v: number) { countdownValue.value = v }

  function resetGame() {
    score.value = 0
    combo.value = 0
    maxCombo.value = 0
    judgments.value = { perfect: 0, great: 0, good: 0, miss: 0 }
    songTime.value = 0
    judgmentHistory.value = []
    countdownValue.value = 0
    phase.value = 'idle'
  }

  return {
    phase, score, combo, maxCombo, judgments, songTime,
    currentChart, judgmentHistory, countdownValue,
    totalNotes, grade,
    setPhase, addScore, incrementCombo, resetCombo,
    addJudgment, addJudgmentHistory, setSongTime, setChart,
    setCountdown, resetGame
  }
})

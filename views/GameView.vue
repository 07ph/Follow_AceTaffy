<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'
import { audioEngine } from '../audio/AudioEngine'
import { GameRenderer } from '../game/GameRenderer'
import type { Judgment, Note } from '../types'

const AUDIO_DB_NAME = 'rhythm-pulse-audio'
const AUDIO_STORE_NAME = 'audio-files'

function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUDIO_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
        db.createObjectStore(AUDIO_STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function loadAudioFromDB(key: string): Promise<string | null> {
  const db = await openAudioDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE_NAME, 'readonly')
    const request = tx.objectStore(AUDIO_STORE_NAME).get(key)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

const router = useRouter()
const route = useRoute()
const gameStore = useGameStore()
const settingsStore = useSettingsStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: GameRenderer | null = null
let animId = 0
let gameLoopId = 0
let countdownTimer: ReturnType<typeof setInterval> | null = null
let gameStartTime = 0 // 无音频模式的时间基准
let noAudioMode = false // 是否处于无音频模式
let pauseStartTime = 0
let pausedDuration = 0
const heldNotes = new Map<string, Note>() // 追踪正在按住的 hold 音符

const isPaused = ref(false)
const countdown = ref(0)

// 获取当前歌曲时间（支持无音频模式）
function getSongTime(): number {
  if (noAudioMode) {
    return (performance.now() - gameStartTime - pausedDuration) / 1000 + settingsStore.offset
  }
  return audioEngine.getBGMTime() + settingsStore.offset + settingsStore.inputOffset
}

// 判定容差（毫秒）
const JUDGMENT_WINDOWS = {
  perfect: 50,
  great: 100,
  good: 150,
  miss: 200
}

const JUDGMENT_SCORES = {
  perfect: 300,
  great: 200,
  good: 100,
  miss: 0
}

function getJudgment(diff: number): Judgment {
  const abs = Math.abs(diff)
  if (abs <= JUDGMENT_WINDOWS.perfect) return 'perfect'
  if (abs <= JUDGMENT_WINDOWS.great) return 'great'
  if (abs <= JUDGMENT_WINDOWS.good) return 'good'
  return 'miss'
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.repeat) return

  if (e.key === 'Escape') {
    if (gameStore.phase === 'playing') {
      isPaused.value = true
      gameStore.setPhase('paused')
      audioEngine.pauseBGM()
      if (noAudioMode) {
        pauseStartTime = performance.now()
      }
    } else if (gameStore.phase === 'paused') {
      isPaused.value = false
      gameStore.setPhase('playing')
      audioEngine.playBGM()
      if (noAudioMode) {
        pausedDuration += performance.now() - pauseStartTime
      }
    }
    return
  }

  if (gameStore.phase !== 'playing') return

  let track = -1
  if (e.key === ' ') {
    track = -1 // 任意轨道
  } else {
    return
  }

  e.preventDefault()

  // 触发应援棒
  renderer?.triggerPenlight(track)

  const songTime = getSongTime()

  if (track === -1) {
    // Space bar triggers both tracks
    tryJudgeTrack(0, songTime)
    tryJudgeTrack(1, songTime)
  } else {
    tryJudgeTrack(track, songTime)
  }
}

function tryJudgeTrack(track: number, songTime: number) {
  const chart = gameStore.currentChart
  if (!chart) return

  let bestNote: Note | null = null
  let bestDiff = Infinity

  for (const note of chart.notes) {
    if (note.hit || note.missed) continue
    if (note.track !== track) continue
    if (note.type === 'things') continue

    const diff = Math.abs(note.time - songTime) * 1000 // 转为毫秒
    if (diff < bestDiff) {
      bestDiff = diff
      bestNote = note
    }
  }

  if (bestNote && bestDiff <= JUDGMENT_WINDOWS.miss) {
    if (bestNote.type === 'hold') {
      // Hold 音符：按下时只标记开始，不给分
      bestNote.hit = true
      bestNote.holdStartTime = songTime
      heldNotes.set(bestNote.id, bestNote)

      // 判定效果（只显示判定，不计分）
      const judgment = getJudgment(bestDiff)
      const judgePos = bestNote.track === 0
        ? renderer?.getJudgePositions().left
        : renderer?.getJudgePositions().right
      if (judgePos) {
        renderer?.addJudgmentEffect(judgePos.x, judgePos.y, judgment)
      }
    } else {
      // Tap / Special 音符：立即给分
      const judgment = getJudgment(bestDiff)
      bestNote.hit = true

      gameStore.addJudgment(judgment)
      gameStore.addScore(JUDGMENT_SCORES[judgment])
      gameStore.addJudgmentHistory({
        judgment,
        time: songTime,
        track: bestNote.track,
        noteId: bestNote.id
      })

      if (judgment === 'miss') {
        gameStore.resetCombo()
      } else {
        gameStore.incrementCombo()
      }

      const judgePos = bestNote.track === 0
        ? renderer?.getJudgePositions().left
        : renderer?.getJudgePositions().right
      if (judgePos) {
        renderer?.addJudgmentEffect(judgePos.x, judgePos.y, judgment)
      }
    }
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (gameStore.phase !== 'playing') return

  if (e.key === ' ') {
    releaseHold(0)
    releaseHold(1)
  }
}

function releaseHold(track: number) {
  const chart = gameStore.currentChart
  if (!chart) return
  const songTime = getSongTime()

  for (const note of chart.notes) {
    if (note.type !== 'hold') continue
    if (note.track !== track) continue
    if (!heldNotes.has(note.id)) continue

    const holdDuration = note.duration || 0
    const holdProgress = songTime - (note.holdStartTime || 0)

    if (holdProgress >= holdDuration * 0.8) {
      // hold 完成 - 根据按下精度给判定和分数
      const judgment = 'perfect'
      gameStore.addJudgment(judgment)
      gameStore.addScore(JUDGMENT_SCORES[judgment] + 100) // 基础分 + hold 完成奖励
      gameStore.addJudgmentHistory({
        judgment,
        time: songTime,
        track: note.track,
        noteId: note.id
      })
      gameStore.incrementCombo()
      const judgePos = note.track === 0
        ? renderer?.getJudgePositions().left
        : renderer?.getJudgePositions().right
      if (judgePos) {
        renderer?.addJudgmentEffect(judgePos.x, judgePos.y, judgment)
      }
      heldNotes.delete(note.id)
    } else {
      // 提前松手 - 算 miss
      note.missed = true
      gameStore.addJudgment('miss')
      gameStore.resetCombo()
      const judgePos = note.track === 0
        ? renderer?.getJudgePositions().left
        : renderer?.getJudgePositions().right
      if (judgePos) {
        renderer?.addJudgmentEffect(judgePos.x, judgePos.y, 'miss')
      }
      heldNotes.delete(note.id)
    }
  }
}

function handleCanvasClick(e: MouseEvent) {
  if (gameStore.phase !== 'playing') return

  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const track = x < rect.width / 2 ? 0 : 1

  renderer?.triggerPenlight(track)

  const songTime = getSongTime()
  tryJudgeTrack(track, songTime)
}

function startCountdown() {
  gameStore.setPhase('countdown')
  countdown.value = 3

  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      if (countdownTimer) clearInterval(countdownTimer)
      countdownTimer = null
      startPlaying()
    }
  }, 1000)
}

async function startPlaying() {
  gameStore.setPhase('playing')
  audioEngine.setVolume(settingsStore.bgmVolume)

  if (audioEngine.isLoaded()) {
    audioEngine.playBGM()
    noAudioMode = false
  } else {
    // 无音频模式：用 performance.now 驱动
    noAudioMode = true
    gameStartTime = performance.now()
  }

  // 游戏主循环
  const chart = gameStore.currentChart
  if (!chart) return

  const checkEnd = () => {
    if (gameStore.phase !== 'playing') return

    const songTime = getSongTime()
    gameStore.setSongTime(songTime)

    // 检查是否所有音符都已处理
    const allProcessed = chart.notes.every(n => n.type === 'things' || n.hit || n.missed)
    const songEnded = noAudioMode ? false : (!audioEngine.isPlaying() && audioEngine.getBGMTime() > 0)

    if (allProcessed || songEnded) {
      // 标记剩余未处理的音符为 miss
      for (const note of chart.notes) {
        if (note.type === 'things') continue
        if (!note.hit && !note.missed) {
          note.missed = true
          gameStore.addJudgment('miss')
        }
      }
      // 3秒后进入结算
      setTimeout(() => {
        if (gameStore.phase === 'playing') {
          endGame()
        }
      }, 3000)
      return
    }

    // 检查 miss（音符时间已过但未被击打）
    for (const note of chart.notes) {
      if (note.type === 'things') continue
      if (!note.hit && !note.missed) {
        const diff = (songTime - note.time) * 1000
        if (diff > JUDGMENT_WINDOWS.miss) {
          note.missed = true
          gameStore.addJudgment('miss')
          gameStore.resetCombo()

          const judgePos = note.track === 0
            ? renderer?.getJudgePositions().left
            : renderer?.getJudgePositions().right
          if (judgePos) {
            renderer?.addJudgmentEffect(judgePos.x, judgePos.y, 'miss')
          }
        }
      }
    }

    // 检查 hold 自动完成（按住超过 hold 时长）
    for (const [id, note] of heldNotes) {
      const holdDuration = note.duration || 0
      const holdProgress = songTime - (note.holdStartTime || 0)
      if (holdProgress >= holdDuration) {
        // hold 时间到，自动完成
        gameStore.addJudgment('perfect')
        gameStore.addScore(JUDGMENT_SCORES['perfect'] + 100)
        gameStore.addJudgmentHistory({
          judgment: 'perfect',
          time: songTime,
          track: note.track,
          noteId: note.id
        })
        gameStore.incrementCombo()
        heldNotes.delete(id)
      }
    }

    gameLoopId = requestAnimationFrame(checkEnd)
  }

  gameLoopId = requestAnimationFrame(checkEnd)
}

function renderLoop() {
  if (!renderer || !canvasRef.value) return

  const songTime = gameStore.phase === 'playing'
    ? getSongTime()
    : 0

  renderer.render(
    songTime,
    gameStore.currentChart?.notes ?? [],
    gameStore.combo,
    gameStore.score,
    countdown.value,
    isPaused.value
  )

  animId = requestAnimationFrame(renderLoop)
}

function endGame() {
  gameStore.setPhase('ended')
  audioEngine.stopBGM()
  cancelAnimationFrame(gameLoopId)
  cancelAnimationFrame(animId)
  router.push('/result')
}

function retryFromPause() {
  cancelAnimationFrame(gameLoopId)
  cancelAnimationFrame(animId)
  audioEngine.stopBGM()
  isPaused.value = false
  initGame()
  renderLoop()
}

function exitGame() {
  gameStore.setPhase('ended')
  audioEngine.stopBGM()
  cancelAnimationFrame(gameLoopId)
  cancelAnimationFrame(animId)
  router.push('/select')
}

async function initGame() {
  if (!canvasRef.value) return

  renderer = new GameRenderer(canvasRef.value)
  gameStore.resetGame()
  gameStore.setPhase('loading')
  isPaused.value = false
  noAudioMode = false
  pausedDuration = 0
  pauseStartTime = 0

  // Clear held notes
  heldNotes.clear()

  // Deep copy chart notes and reset all per-note state
  if (gameStore.currentChart) {
    gameStore.currentChart.notes = JSON.parse(JSON.stringify(gameStore.currentChart.notes))
    for (const note of gameStore.currentChart.notes) {
      note.hit = false
      note.missed = false
      note.holdStartTime = undefined
    }
  }

  // Try to load saved audio from IndexedDB
  const audioKey = localStorage.getItem('rhythm-pulse-game-audio-key')
  const songId = (gameStore.currentChart as any)?.id
  const songAudioUrl = (gameStore.currentChart as any)?.audioUrl
  const dbKey = audioKey || (songId ? `song-${songId}` : null)

  if (dbKey) {
    if (audioKey) localStorage.removeItem('rhythm-pulse-game-audio-key')
    try {
      const db = await openAudioDB()
      const audioData = await new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction('audio-files', 'readonly')
        const req = tx.objectStore('audio-files').get(dbKey)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
      })
      if (audioData) {
        const loaded = await audioEngine.loadBGM(audioData, 10000)
        if (loaded) {
          noAudioMode = false
          audioEngine.seek(0)
        } else if (songAudioUrl) {
          const loaded2 = await audioEngine.loadBGM(songAudioUrl, 10000)
          if (loaded2) { noAudioMode = false; audioEngine.seek(0) }
          else { noAudioMode = true; gameStartTime = performance.now() }
        } else {
          noAudioMode = true
          gameStartTime = performance.now()
        }
      } else if (songAudioUrl) {
        const loaded = await audioEngine.loadBGM(songAudioUrl, 10000)
        if (loaded) { noAudioMode = false; audioEngine.seek(0) }
        else { noAudioMode = true; gameStartTime = performance.now() }
      } else {
        noAudioMode = true
        gameStartTime = performance.now()
      }
    } catch (e) {
      console.error('加载音频失败:', e)
      if (songAudioUrl) {
        try {
          const loaded = await audioEngine.loadBGM(songAudioUrl, 10000)
          if (loaded) { noAudioMode = false; audioEngine.seek(0) }
          else { noAudioMode = true; gameStartTime = performance.now() }
        } catch {
          noAudioMode = true; gameStartTime = performance.now()
        }
      } else {
        noAudioMode = true
        gameStartTime = performance.now()
      }
    }
  } else if (songAudioUrl) {
    try {
      const loaded = await audioEngine.loadBGM(songAudioUrl, 10000)
      if (loaded) { noAudioMode = false; audioEngine.seek(0) }
      else { noAudioMode = true; gameStartTime = performance.now() }
    } catch {
      noAudioMode = true; gameStartTime = performance.now()
    }
  } else {
    noAudioMode = true
    gameStartTime = performance.now()
  }

  startCountdown()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', () => renderer?.resize())
  canvasRef.value?.addEventListener('click', handleCanvasClick)
  initGame()
  renderLoop()
})

// 监听路由变化（从结算页"再来一次"时重新初始化）
watch(() => route.query.retry, () => {
  if (route.query.retry) {
    cancelAnimationFrame(gameLoopId)
    cancelAnimationFrame(animId)
    audioEngine.stopBGM()
    initGame()
    renderLoop()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  canvasRef.value?.removeEventListener('click', handleCanvasClick)
  cancelAnimationFrame(animId)
  cancelAnimationFrame(gameLoopId)
  if (countdownTimer) clearInterval(countdownTimer)
  audioEngine.destroy()
})
</script>

<template>
  <div class="game-container">
    <canvas ref="canvasRef" class="game-canvas" />
    <div v-if="isPaused" class="pause-overlay">
      <div class="pause-content">
        <p class="pause-text">暂停</p>
        <p class="pause-hint">按 ESC 继续</p>
        <div class="pause-buttons">
          <button class="pause-btn" @click="retryFromPause">🔄 再来一次</button>
          <button class="exit-btn" @click="exitGame">退出</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.pause-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.pause-content {
  text-align: center;
}

.pause-text {
  font-size: 48px;
  font-weight: bold;
  color: #ffffff;
  margin: 0 0 12px 0;
}

.pause-hint {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 30px 0;
}

.pause-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.pause-btn {
  padding: 12px 32px;
  font-size: 18px;
  color: #ffffff;
  background: rgba(255, 215, 0, 0.6);
  border: 1px solid rgba(255, 215, 0, 0.8);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.pause-btn:hover {
  background: rgba(255, 215, 0, 0.8);
}

.exit-btn {
  padding: 12px 32px;
  font-size: 18px;
  color: #ffffff;
  background: rgba(255, 68, 68, 0.6);
  border: 1px solid rgba(255, 68, 68, 0.8);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.exit-btn:hover {
  background: rgba(255, 68, 68, 0.8);
}
</style>

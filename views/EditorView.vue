<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useEditorStore } from '../stores/editor'
import { audioEngine } from '../audio/AudioEngine'
import { GameRenderer } from '../game/GameRenderer'
import type { NoteType, Note } from '../types'

// IndexedDB helper for audio storage
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

async function saveAudioToDB(key: string, data: string): Promise<void> {
  const db = await openAudioDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite')
    tx.objectStore(AUDIO_STORE_NAME).put(data, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
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

async function deleteAudioFromDB(key: string): Promise<void> {
  const db = await openAudioDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite')
    tx.objectStore(AUDIO_STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

const router = useRouter()
const editor = useEditorStore()

const timelineCanvas = ref<HTMLCanvasElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const tapImageInput = ref<HTMLInputElement | null>(null)
const specialImageInput = ref<HTMLInputElement | null>(null)

let animId = 0
let scrollOffset = 0
const pixelsPerSecond = 100

// Box select state
const isBoxSelecting = ref(false)
const boxStart = ref({ x: 0, y: 0 })
const boxEnd = ref({ x: 0, y: 0 })

// Hold note tail drag state
const isDraggingHold = ref(false)
const draggingNoteId = ref<string | null>(null)

// Batch drag state
const isDraggingNotes = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragDeltaX = ref(0)
const dragDeltaY = ref(0)

// Playhead drag state
const isDraggingPlayhead = ref(false)

// Recording mode
const isRecording = ref(false)
const recordBothTracks = ref(false)

// Save separation
const editSource = ref<'song-list' | 'standalone'>('standalone')
const editingSongId = ref<string | null>(null)

// Audio data persistence
const audioDataUrl = ref<string | null>(null)

// Editable song metadata
const chartTitle = ref('自定义谱面')
const chartArtist = ref('')
const chartDifficulty = ref('Normal')
const chartLevel = ref(5)

// Save confirmation toast
const saveMessage = ref<string | null>(null)
let saveTimer: number | null = null

const noteTypes: { type: NoteType; label: string; color: string }[] = [
  { type: 'tap', label: 'Tap', color: '#ff6b9d' },
  { type: 'hold', label: 'Hold', color: '#c44dff' },
  { type: 'special', label: 'Special', color: '#ffd700' },
  { type: 'things', label: 'Things', color: '#ff4444' }
]

function generateId(): string {
  return 'note_' + Math.random().toString(36).substr(2, 9)
}

function snapToGrid(time: number): number {
  const beatDuration = 60 / editor.bpm
  const gridDuration = beatDuration / editor.gridDivision
  return Math.round(time / gridDuration) * gridDuration
}

function timeToX(time: number): number {
  return time * pixelsPerSecond * editor.zoom - scrollOffset
}

function xToTime(x: number): number {
  return (x + scrollOffset) / (pixelsPerSecond * editor.zoom)
}

function isNearHoldEnd(note: Note, x: number, y: number, canvasHeight: number): boolean {
  if (note.type !== 'hold') return false
  const beatDuration = 60 / editor.bpm
  const duration = note.duration || beatDuration
  const endX = timeToX(note.time + duration)
  const trackH = canvasHeight / 2
  const noteY = note.track === 0 ? trackH / 2 : trackH + trackH / 2
  return Math.abs(endX - x) < 8 && Math.abs(noteY - y) < 12
}

function loadAudio() {
  fileInput.value?.click()
}

async function handleAudioLoad(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const url = URL.createObjectURL(file)
  await audioEngine.loadBGM(url)
  editor.setBpm(editor.bpm)

  // Store audio in IndexedDB for persistence
  const arrayBuffer = await file.arrayBuffer()
  const base64 = arrayBufferToBase64(arrayBuffer)
  audioDataUrl.value = `data:audio/${file.name.split('.').pop()};base64,${base64}`

  // Save to IndexedDB
  const dbKey = editSource.value === 'song-list' && editingSongId.value
    ? `song-${editingSongId.value}`
    : 'editor-draft'
  await saveAudioToDB(dbKey, audioDataUrl.value)
}

function togglePlay() {
  if (audioEngine.isPlaying()) {
    audioEngine.pauseBGM()
    editor.setPlaying(false)
  } else {
    // Seek to playhead position first
    const playheadTime = xToTime(80)
    if (audioEngine.isLoaded()) {
      audioEngine.seek(playheadTime)
    }
    audioEngine.playBGM()
    editor.setPlaying(true)
  }
}

function stopPlayback() {
  audioEngine.stopBGM()
  audioEngine.seek(0)
  editor.setPlaying(false)
  editor.setCurrentTime(0)
}

function handleTimelineMouseDown(e: MouseEvent) {
  const canvas = timelineCanvas.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // 所有拖拽操作绑定到 window，防止鼠标移出 canvas 后丢失事件
  const onMove = (ev: MouseEvent) => {
    const r = canvas.getBoundingClientRect()
    handleTimelineMouseMove(ev, r)
  }
  const onUp = (ev: MouseEvent) => {
    const r = canvas.getBoundingClientRect()
    handleTimelineMouseUp(ev, r)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)

  const timelineHeight = 22
  const trackHeight = (canvas.height - timelineHeight) / 2
  const track = y < timelineHeight ? -1 : (y < timelineHeight + trackHeight ? 0 : 1)

  // Check if clicking on the playhead (within 6px of x=80)
  if (Math.abs(x - 80) < 6 && y >= 22) {
    isDraggingPlayhead.value = true
    return
  }

  // Check if clicking near a hold note's end handle (for tail dragging)
  for (const note of editor.notes) {
    if (isNearHoldEnd(note, x, y, canvas.height)) {
      isDraggingHold.value = true
      draggingNoteId.value = note.id
      editor.selectNote(note.id)
      return
    }
  }

  // Ctrl + click/drag: start box select
  if (e.ctrlKey) {
    isBoxSelecting.value = true
    boxStart.value = { x, y }
    boxEnd.value = { x, y }
    return
  }

  const time = snapToGrid(xToTime(x))
  if (time < 0) return

  // 检查是否点击了已有音符（不限制轨道，支持跨轨道拖拽）
  const clickedNote = editor.notes.find(n => {
    const nx = timeToX(n.time)
    const tlH = 22
    const tH = (canvas.height - tlH) / 2
    const ny = (n.track === 0 ? tH / 2 : tH + tH / 2) + tlH
    return Math.abs(nx - x) < 15 && Math.abs(ny - y) < tH * 0.5
  })

  if (clickedNote) {
    // Check if clicking on an already-selected note (batch drag)
    const isAlreadySelected = editor.multiSelectedIds.includes(clickedNote.id) || editor.selectedNoteId === clickedNote.id
    if (isAlreadySelected && !e.shiftKey) {
      // Start batch drag
      isDraggingNotes.value = true
      dragStartX.value = x
      dragStartY.value = y
      dragDeltaX.value = 0
      dragDeltaY.value = 0
      return
    }
    if (e.shiftKey) {
      // Shift+click: toggle multi-select
      editor.toggleMultiSelect(clickedNote.id)
    } else {
      editor.selectNote(clickedNote.id)
      editor.clearMultiSelection()
    }
  } else if (track >= 0) {
    // 空白区域：立即放置新音符
    const newNote: Note = {
      id: generateId(),
      time: Math.round(time * 1000) / 1000,
      type: editor.selectedType,
      track,
      hit: false,
      missed: false
    }

    if (editor.selectedType === 'hold') {
      newNote.duration = 60 / editor.bpm
    }

    editor.addNote(newNote)
    editor.selectNote(newNote.id)
    editor.clearMultiSelection()
  }
}

function handleTimelineMouseMove(e: MouseEvent, rect?: DOMRect) {
  const canvas = timelineCanvas.value
  if (!canvas) return

  if (!rect) rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  if (isDraggingPlayhead.value) {
    // Dragging playhead: adjust scrollOffset so the time under cursor stays at x=80
    const timeUnderCursor = xToTime(x)
    scrollOffset = timeUnderCursor * pixelsPerSecond * editor.zoom - 80
    return
  }

  if (isBoxSelecting.value) {
    boxEnd.value = { x, y }
    return
  }

  if (isDraggingNotes.value) {
    dragDeltaX.value = x - dragStartX.value
    dragDeltaY.value = y - dragStartY.value
    return
  }

  if (isDraggingHold.value && draggingNoteId.value) {
    const time = xToTime(x)
    const note = editor.notes.find(n => n.id === draggingNoteId.value)
    if (note && time > note.time) {
      const snappedDuration = snapToGrid(time - note.time)
      if (snappedDuration > 0) {
        note.duration = snappedDuration
      }
    }
  }

  // Update cursor for hold note end handles
  if (Math.abs(x - 80) < 6 && y >= 22) {
    canvas.style.cursor = 'col-resize'
    return
  }
  let overHoldEnd = false
  for (const note of editor.notes) {
    if (isNearHoldEnd(note, x, y, canvas.height)) {
      overHoldEnd = true
      break
    }
  }
  canvas.style.cursor = overHoldEnd ? 'ew-resize' : 'crosshair'
}

function handleTimelineMouseUp(e: MouseEvent, rect?: DOMRect) {
  const canvas = timelineCanvas.value
  if (!canvas) return

  if (!rect) rect = canvas.getBoundingClientRect()

  if (isDraggingPlayhead.value) {
    isDraggingPlayhead.value = false
    // Seek audio to the playhead position
    const playheadTime = xToTime(80)
    if (audioEngine.isLoaded()) {
      audioEngine.seek(playheadTime)
    }
    editor.setCurrentTime(playheadTime)
    return
  }

  if (isBoxSelecting.value) {
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    boxEnd.value = { x, y }

    const left = Math.min(boxStart.value.x, boxEnd.value.x)
    const right = Math.max(boxStart.value.x, boxEnd.value.x)
    const top = Math.min(boxStart.value.y, boxEnd.value.y)
    const bottom = Math.max(boxStart.value.y, boxEnd.value.y)
    const timelineHeight = 22
    const trackH = (canvas.height - timelineHeight) / 2

    // 框选：替换当前多选
    const selected: string[] = []
    for (const note of editor.notes) {
      const nx = timeToX(note.time)
      const ny = (note.track === 0 ? trackH / 2 : trackH + trackH / 2) + timelineHeight
      if (nx >= left && nx <= right && ny >= top && ny <= bottom) {
        selected.push(note.id)
      }
    }
    editor.multiSelectedIds = selected

    isBoxSelecting.value = false
    return
  }

  if (isDraggingNotes.value) {
    const rawDelta = dragDeltaX.value / (pixelsPerSecond * editor.zoom)
    const gridDur = 60 / editor.bpm / editor.gridDivision
    const deltaTime = Math.round(rawDelta / gridDur) * gridDur

    // 计算跨轨道偏移
    const timelineHeight = 22
    const trackH = (canvas.height - timelineHeight) / 2
    let deltaTrack = 0
    if (Math.abs(dragDeltaY.value) > trackH * 0.4) {
      deltaTrack = dragDeltaY.value > 0 ? 1 : -1
    }

    if (Math.abs(deltaTime) > 0.001 || deltaTrack !== 0) {
      const ids: string[] = [...editor.multiSelectedIds]
      if (editor.selectedNoteId && !ids.includes(editor.selectedNoteId)) {
        ids.push(editor.selectedNoteId)
      }
      editor.moveNotes(ids, deltaTime, deltaTrack)
    }
    isDraggingNotes.value = false
    dragDeltaX.value = 0
    dragDeltaY.value = 0
    return
  }

  if (isDraggingHold.value && draggingNoteId.value) {
    // Snap duration to grid and push undo
    const note = editor.notes.find(n => n.id === draggingNoteId.value)
    if (note) {
      const snappedDuration = snapToGrid(note.duration || 0)
      if (snappedDuration > 0) {
        editor.pushUndo()
        note.duration = snappedDuration
      }
    }
    isDraggingHold.value = false
    draggingNoteId.value = null
  }
}

function handleTimelineRightClick(e: MouseEvent) {
  e.preventDefault()
  const canvas = timelineCanvas.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const trackHeight = canvas.height / 2
  const track = y < trackHeight ? 0 : 1

  const clickedNote = editor.notes.find(n => {
    const nx = timeToX(n.time)
    return Math.abs(nx - x) < 15 && n.track === track
  })

  if (clickedNote) {
    editor.removeNote(clickedNote.id)
  } else {
    // Right-click on empty space: clear multi-selection
    editor.clearMultiSelection()
  }
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  if (e.ctrlKey) {
    // 缩放
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    editor.setZoom(editor.zoom + delta)
  } else {
    // 水平滚动
    scrollOffset = Math.max(0, scrollOffset + e.deltaX + e.deltaY)
  }
}

function exportChart() {
  const chart = {
    title: chartTitle.value,
    artist: chartArtist.value,
    difficulty: chartDifficulty.value,
    level: chartLevel.value,
    bpm: editor.bpm,
    offset: 0,
    notes: editor.notes.map(n => ({
      id: n.id,
      time: n.time,
      type: n.type,
      track: n.track,
      duration: n.duration
    })),
    audioData: audioDataUrl.value
  }

  const blob = new Blob([JSON.stringify(chart, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'chart.json'
  a.click()
  URL.revokeObjectURL(url)
}

function importChart() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const chart = JSON.parse(ev.target?.result as string)
        if (chart.notes) {
          editor.loadNotes(chart.notes)
          if (chart.bpm) editor.setBpm(chart.bpm)
        }
        if (chart.audioData) {
          audioDataUrl.value = chart.audioData
          audioEngine.loadBGM(chart.audioData)
          saveAudioToDB('editor-draft', chart.audioData)
        }
        if (chart.title) {
          chartTitle.value = chart.title
        }
        if (chart.artist !== undefined) chartArtist.value = chart.artist
        if (chart.difficulty) chartDifficulty.value = chart.difficulty
        if (chart.level !== undefined) chartLevel.value = chart.level
      } catch (err) {
        console.error('导入谱面失败:', err)
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function uploadTapImage() {
  tapImageInput.value?.click()
}

function uploadSpecialImage() {
  specialImageInput.value?.click()
}

function handleTapImageLoad(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  GameRenderer.tapImagePath = url
}

function handleSpecialImageLoad(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  GameRenderer.specialImagePath = url
}

function clearAllNotes() {
  if (editor.notes.length === 0) return
  editor.pushUndo()
  editor.notes = []
  editor.selectNote(null)
  editor.clearMultiSelection()
}

function handleSave() {
  saveEditorData().then(msg => {
    saveMessage.value = msg
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      saveMessage.value = null
      saveTimer = null
    }, 2000)
  })
}

async function saveEditorData() {
  if (editSource.value === 'song-list' && editingSongId.value) {
    // ONLY save to song list, do NOT touch editor draft
    const songsRaw = localStorage.getItem('rhythm-pulse-songs')
    const songs = songsRaw ? JSON.parse(songsRaw) : []
    const song = songs.find((s: any) => s.id === editingSongId.value)
    if (song) {
      song.notes = editor.notes.map(n => ({
        id: n.id, time: n.time, type: n.type, track: n.track, duration: n.duration
      }))
      song.title = chartTitle.value
      song.artist = chartArtist.value
      song.difficulty = chartDifficulty.value
      song.level = chartLevel.value
      song.bpm = editor.bpm
      localStorage.setItem('rhythm-pulse-songs', JSON.stringify(songs))
      // Save audio to IndexedDB
      if (audioDataUrl.value) {
        await saveAudioToDB('song-' + editingSongId.value, audioDataUrl.value)
      }
    }
    return '✅ 已保存到歌曲列表'
  }

  if (editSource.value === 'standalone') {
    // ONLY save to editor draft, do NOT touch any song
    const data = {
      notes: editor.notes,
      bpm: editor.bpm,
      gridDivision: editor.gridDivision,
      zoom: editor.zoom,
      title: chartTitle.value,
      artist: chartArtist.value,
      difficulty: chartDifficulty.value,
      level: chartLevel.value
    }
    localStorage.setItem('rhythm-pulse-editor-draft', JSON.stringify(data))
    // Save audio to IndexedDB
    if (audioDataUrl.value) {
      await saveAudioToDB('editor-draft', audioDataUrl.value)
    }
    return '✅ 已保存到编辑器存档'
  }

  return '未保存'
}

async function loadEditorData() {
  const editingId = localStorage.getItem('rhythm-pulse-editing-id')
  if (editingId) {
    const songsRaw = localStorage.getItem('rhythm-pulse-songs')
    const songs = songsRaw ? JSON.parse(songsRaw) : []
    const song = songs.find((s: any) => s.id === editingId)
    if (song && song.notes) {
      editSource.value = 'song-list'
      editingSongId.value = editingId
      editor.loadNotes(song.notes)
      if (song.bpm) editor.setBpm(song.bpm)
      if (song.title) chartTitle.value = song.title
      if (song.artist !== undefined) chartArtist.value = song.artist
      if (song.difficulty) chartDifficulty.value = song.difficulty
      if (song.level !== undefined) chartLevel.value = song.level
      const audioData = await loadAudioFromDB('song-' + editingId)
      if (audioData) {
        audioDataUrl.value = audioData
        audioEngine.loadBGM(audioData)
      }
      return
    }
  }
  editSource.value = 'standalone'
  const draft = localStorage.getItem('rhythm-pulse-editor-draft')
  if (draft) {
    try {
      const data = JSON.parse(draft)
      editor.loadNotes(data.notes || [])
      if (data.bpm) editor.setBpm(data.bpm)
      if (data.gridDivision) editor.setGridDivision(data.gridDivision)
      if (data.zoom) editor.setZoom(data.zoom)
      if (data.title) chartTitle.value = data.title
      if (data.artist !== undefined) chartArtist.value = data.artist
      if (data.difficulty) chartDifficulty.value = data.difficulty
      if (data.level !== undefined) chartLevel.value = data.level
      const audioData = await loadAudioFromDB('editor-draft')
      if (audioData) {
        audioDataUrl.value = audioData
        audioEngine.loadBGM(audioData)
      }
    } catch (e) {
      console.error('加载编辑器存档失败:', e)
    }
  }
}

function renderTimeline() {
  const canvas = timelineCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height
  const timelineH = 22
  const trackH = (h - timelineH) / 2

  ctx.clearRect(0, 0, w, h)

  // 背景
  ctx.fillStyle = 'rgba(26, 10, 46, 0.8)'
  ctx.fillRect(0, 0, w, h)

  // 时间轴区域（顶部，不受滚动影响）
  ctx.save()
  ctx.fillStyle = 'rgba(15, 5, 30, 0.95)'
  ctx.fillRect(0, 0, w, timelineH)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, timelineH)
  ctx.lineTo(w, timelineH)
  ctx.stroke()

  // 时间轴刻度
  ctx.font = '10px "Microsoft YaHei", sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.textAlign = 'center'
  const axisStartTime = xToTime(0)
  const axisEndTime = xToTime(w)
  const axisBeatDur = 60 / editor.bpm
  for (let t = Math.floor(axisStartTime / axisBeatDur) * axisBeatDur; t <= axisEndTime; t += axisBeatDur) {
    const x = timeToX(t)
    if (x < 0 || x > w) continue
    const minutes = Math.floor(t / 60)
    const seconds = Math.floor(t % 60)
    const ms = Math.floor((t % 1) * 10)
    const label = `${minutes}:${String(seconds).padStart(2, '0')}.${ms}`
    ctx.fillText(label, x, 15)
    // 小刻度线
    ctx.beginPath()
    ctx.moveTo(x, timelineH - 4)
    ctx.lineTo(x, timelineH)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.stroke()
  }
  ctx.restore()

  // 轨道分隔线（考虑时间轴高度偏移）
  const trackAreaY = timelineH
  ctx.beginPath()
  ctx.moveTo(0, trackAreaY + trackH)
  ctx.lineTo(w, trackAreaY + trackH)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.lineWidth = 1
  ctx.stroke()

  // 轨道标签（偏移到时间轴下方）
  ctx.font = '12px "Microsoft YaHei", sans-serif'
  ctx.fillStyle = 'rgba(255, 107, 157, 0.6)'
  ctx.fillText('左轨道', 5, trackAreaY + 15)
  ctx.fillStyle = 'rgba(196, 77, 255, 0.6)'
  ctx.fillText('右轨道', 5, trackAreaY + trackH + 15)

  // 网格线
  const beatDuration = 60 / editor.bpm
  const gridDuration = beatDuration / editor.gridDivision
  const startTime = xToTime(0)
  const endTime = xToTime(w)

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1

  for (let t = Math.floor(startTime / gridDuration) * gridDuration; t <= endTime; t += gridDuration) {
    const x = timeToX(t)
    if (x < 0 || x > w) continue
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }

  // 拍号线（更亮）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  for (let t = Math.floor(startTime / beatDuration) * beatDuration; t <= endTime; t += beatDuration) {
    const x = timeToX(t)
    if (x < 0 || x > w) continue
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }

  // 绘制音符
  for (const note of editor.notes) {
    let x = timeToX(note.time)
    let y = (note.track === 0 ? trackH / 2 : trackH + trackH / 2) + timelineH

    // Apply batch drag offset visually (snapped to grid)
    const isMultiSelected = editor.multiSelectedIds.includes(note.id)
    const isSelected = note.id === editor.selectedNoteId
    if (isDraggingNotes.value && (isMultiSelected || isSelected)) {
      const rawDelta = dragDeltaX.value / (pixelsPerSecond * editor.zoom)
      const gridDur = 60 / editor.bpm / editor.gridDivision
      const snappedDelta = Math.round(rawDelta / gridDur) * gridDur
      x += snappedDelta * pixelsPerSecond * editor.zoom
      y += dragDeltaY.value
    }
    if (x < -20 || x > w + 20) continue

    ctx.save()
    if (isSelected) {
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = 10
    } else if (isMultiSelected) {
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 8
    }

    switch (note.type) {
      case 'tap': {
        const color = note.track === 0 ? '#ff6b9d' : '#c44dff'
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.roundRect(x - 12, y - 8, 24, 16, 4)
        ctx.fill()
        break
      }
      case 'hold': {
        const color = note.track === 0 ? '#ff6b9d' : '#c44dff'
        const colorRgb = note.track === 0 ? '255, 107, 157' : '196, 77, 255'
        const duration = note.duration || beatDuration
        const endX = timeToX(note.time + duration)
        ctx.fillStyle = `rgba(${colorRgb}, 0.3)`
        ctx.fillRect(x, y - 8, endX - x, 16)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.roundRect(x - 12, y - 8, 24, 16, 4)
        ctx.fill()
        // 右端手柄
        ctx.beginPath()
        ctx.roundRect(endX - 4, y - 10, 8, 20, 2)
        ctx.fillStyle = `rgba(${colorRgb}, 0.7)`
        ctx.fill()
        break
      }
      case 'special': {
        ctx.fillStyle = '#ffd700'
        ctx.beginPath()
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? 12 : 6
          const angle = (Math.PI * i) / 5 - Math.PI / 2
          const px = x + Math.cos(angle) * r
          const py = y + Math.sin(angle) * r
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fill()
        break
      }
      case 'things': {
        ctx.strokeStyle = '#ff4444'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.strokeRect(x - 12, y - 8, 24, 16)
        ctx.setLineDash([])
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('⚡', x, y)
        break
      }
    }
    ctx.restore()

    // Draw multi-select gold dashed border
    if (isMultiSelected) {
      ctx.save()
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      if (note.type === 'hold') {
        const duration = note.duration || beatDuration
        const endX = timeToX(note.time + duration)
        ctx.strokeRect(x - 13, y - 9, endX - x + 26, 18)
      } else {
        ctx.strokeRect(x - 13, y - 9, 26, 18)
      }
      ctx.setLineDash([])
      ctx.restore()
    }
  }

  // 播放指针（始终固定在左侧 80px 位置）
  const playheadX = 80
  ctx.beginPath()
  ctx.moveTo(playheadX, timelineH)
  ctx.lineTo(playheadX, h)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.stroke()

  // Playhead handle (triangle at top)
  ctx.beginPath()
  ctx.moveTo(playheadX - 6, timelineH)
  ctx.lineTo(playheadX + 6, timelineH)
  ctx.lineTo(playheadX, timelineH + 8)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  // Box select rectangle (gold)
  if (isBoxSelecting.value) {
    const left = Math.min(boxStart.value.x, boxEnd.value.x)
    const top = Math.min(boxStart.value.y, boxEnd.value.y)
    const width = Math.abs(boxEnd.value.x - boxStart.value.x)
    const height = Math.abs(boxEnd.value.y - boxStart.value.y)
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)'
    ctx.fillRect(left, top, width, height)
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(left, top, width, height)
    ctx.setLineDash([])
  }

  // Recording indicator (drawn in screen space)
  if (isRecording.value) {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'
    ctx.font = 'bold 16px "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('🔴 录制中', w / 2, 8)
    ctx.restore()
  }
}

function resizeCanvas() {
  const canvas = timelineCanvas.value
  if (!canvas) return
  const container = canvas.parentElement
  if (!container) return
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight
}

function editorLoop() {
  try {
    if (audioEngine.isPlaying()) {
      editor.setCurrentTime(audioEngine.getBGMTime())
      // Lock playhead at left edge (80px)
      scrollOffset = audioEngine.getBGMTime() * pixelsPerSecond * editor.zoom - 80
    }
    renderTimeline()
  } catch (e) {
    console.error('Editor render error:', e, e?.message, e?.stack)
  }
  animId = requestAnimationFrame(editorLoop)
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === ' ') {
    e.preventDefault()
    if (isRecording.value) {
      // Recording mode: place tap note at playhead time
      const time = snapToGrid(audioEngine.getBGMTime())
      if (time < 0) return
      const tracks = recordBothTracks.value ? [0, 1] : [editor.selectedTrack]
      for (const track of tracks) {
        const newNote: Note = {
          id: generateId(),
          time: Math.round(time * 1000) / 1000,
          type: editor.selectedType,
          track,
          hit: false,
          missed: false
        }
        if (editor.selectedType === 'hold') {
          newNote.duration = 60 / editor.bpm
        }
        editor.addNote(newNote)
      }
    } else {
      togglePlay()
    }
  } else if (e.ctrlKey && e.key === 'z') {
    e.preventDefault()
    editor.undo()
  } else if (e.ctrlKey && e.key === 'y') {
    e.preventDefault()
    editor.redo()
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (editor.multiSelectedIds.length > 0) {
      editor.deleteSelected()
    } else if (editor.selectedNoteId) {
      editor.removeNote(editor.selectedNoteId)
    }
  } else if (e.ctrlKey && e.key === 'a') {
    e.preventDefault()
    editor.selectAllNotes()
  } else if (e.key === 'Escape') {
    editor.clearMultiSelection()
    editor.selectNote(null)
  } else if (e.ctrlKey && e.key === 'd') {
    e.preventDefault()
    if (editor.multiSelectedIds.length > 0) {
      editor.duplicateNotes([...editor.multiSelectedIds])
    } else if (editor.selectedNoteId) {
      editor.duplicateNotes([editor.selectedNoteId])
    }
  }
}

onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('keydown', handleKeyDown)
  loadEditorData()
  editorLoop()
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('keydown', handleKeyDown)
  audioEngine.destroy()
  // Auto-save for standalone mode ONLY
  if (editSource.value === 'standalone') {
    const data = {
      notes: editor.notes,
      bpm: editor.bpm,
      gridDivision: editor.gridDivision,
      zoom: editor.zoom,
      title: chartTitle.value,
      artist: chartArtist.value,
      difficulty: chartDifficulty.value,
      level: chartLevel.value
    }
    localStorage.setItem('rhythm-pulse-editor-draft', JSON.stringify(data))
    // Save audio to IndexedDB
    if (audioDataUrl.value) {
      saveAudioToDB('editor-draft', audioDataUrl.value)
    }
  }
})
</script>

<template>
  <div class="editor-container">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">谱面编辑器</span>
        <div class="toolbar-divider" />

        <!-- Song metadata -->
        <div class="metadata-inputs">
          <input
            type="text"
            v-model="chartTitle"
            class="meta-input meta-title"
            placeholder="标题"
          />
          <input
            type="text"
            v-model="chartArtist"
            class="meta-input meta-artist"
            placeholder="艺术家"
          />
          <select v-model="chartDifficulty" class="meta-select">
            <option value="Easy">Easy</option>
            <option value="Normal">Normal</option>
            <option value="Hard">Hard</option>
            <option value="Expert">Expert</option>
            <option value="Master">Master</option>
          </select>
          <input
            type="number"
            v-model.number="chartLevel"
            class="meta-input meta-level"
            min="1"
            max="15"
          />
        </div>

        <div class="toolbar-divider" />

        <!-- 音符类型 -->
        <div class="note-types">
          <button
            v-for="nt in noteTypes"
            :key="nt.type"
            class="note-type-btn"
            :class="{ active: editor.selectedType === nt.type }"
            :style="editor.selectedType === nt.type ? { borderColor: nt.color, color: nt.color } : {}"
            @click="editor.setType(nt.type)"
          >{{ nt.label }}</button>
        </div>

        <div class="toolbar-divider" />

        <!-- 轨道切换 -->
        <div class="track-switch">
          <button
            class="track-btn"
            :class="{ active: editor.selectedTrack === 0 }"
            @click="editor.setTrack(0)"
          >左</button>
          <button
            class="track-btn"
            :class="{ active: editor.selectedTrack === 1 }"
            @click="editor.setTrack(1)"
          >右</button>
        </div>
      </div>

      <div class="toolbar-right">
        <!-- BPM -->
        <div class="bpm-input">
          <label>BPM:</label>
          <input
            type="number"
            :value="editor.bpm"
            @input="editor.setBpm(($event.target as HTMLInputElement).valueAsNumber)"
            min="30"
            max="300"
          />
        </div>

        <!-- 网格细分 -->
        <select :value="editor.gridDivision" @change="editor.setGridDivision(Number(($event.target as HTMLSelectElement).value))">
          <option :value="1">1/1</option>
          <option :value="2">1/2</option>
          <option :value="4">1/4</option>
          <option :value="8">1/8</option>
        </select>

        <!-- 撤销/重做 -->
        <button class="tool-btn" @click="editor.undo()" title="撤销 (Ctrl+Z)">↩️</button>
        <button class="tool-btn" @click="editor.redo()" title="重做 (Ctrl+Y)">↪️</button>

        <div class="toolbar-divider" />

        <!-- 导入/导出 -->
        <button class="tool-btn" @click="importChart">📥 导入</button>
        <button class="tool-btn" @click="exportChart">📤 导出</button>

        <div class="toolbar-divider" />

        <!-- 图案上传 -->
        <button class="tool-btn" @click="uploadTapImage">🎨 Tap图案</button>
        <button class="tool-btn" @click="uploadSpecialImage">✨ Special图案</button>
        <input ref="tapImageInput" type="file" accept="image/*" style="display:none" @change="handleTapImageLoad" />
        <input ref="specialImageInput" type="file" accept="image/*" style="display:none" @change="handleSpecialImageLoad" />

        <div class="toolbar-divider" />

        <!-- 录制模式 -->
        <button class="tool-btn" :class="{ active: isRecording }" @click="isRecording = !isRecording" title="录制模式">
          {{ isRecording ? '🔴 录制中' : '⏺ 录制' }}
        </button>
        <button v-if="isRecording" class="tool-btn" :class="{ active: recordBothTracks }" @click="recordBothTracks = !recordBothTracks" title="双轨录制">
          双轨: {{ recordBothTracks ? '开' : '关' }}
        </button>

        <div class="toolbar-divider" />

        <!-- 保存 -->
        <button class="tool-btn" @click="handleSave">
          💾 保存
          <span class="save-source">({{ editSource === 'song-list' ? '歌曲列表' : '编辑器存档' }})</span>
        </button>
        <!-- 一键清除 -->
        <button class="tool-btn" @click="clearAllNotes" title="清除所有音符">
          🗑️ 清除
        </button>
      </div>
    </div>

    <!-- 播放控制栏 -->
    <div class="playback-bar">
      <button class="play-btn" @click="togglePlay">
        {{ editor.isPlaying ? '⏸' : '▶' }}
      </button>
      <button class="play-btn" @click="stopPlayback">⏹</button>
      <button class="play-btn" @click="loadAudio">🎵 加载音频</button>
      <input ref="fileInput" type="file" accept="audio/*" style="display:none" @change="handleAudioLoad" />

      <span class="time-display">
        {{ editor.currentTime.toFixed(2) }}s
        <template v-if="audioEngine.isLoaded()">
          / {{ audioEngine.getDuration().toFixed(2) }}s
        </template>
      </span>

      <span class="note-count">音符: {{ editor.notes.length }}</span>
      <span v-if="editor.multiSelectedIds.length > 0" class="selected-count">
        已选: {{ editor.multiSelectedIds.length }}
      </span>
    </div>

    <!-- 主编辑区域 -->
    <div class="editor-main">
      <canvas
        ref="timelineCanvas"
        class="timeline-canvas"
        @mousedown="handleTimelineMouseDown"
        @contextmenu="handleTimelineRightClick"
        @wheel="handleWheel"
      />
    </div>

    <!-- 底部状态栏 -->
    <div class="status-bar">
      <button class="btn btn-small" @click="router.push('/')">🏠 返回主页</button>
      <span class="status-info">
        点击放置音符 | 右键删除 | 拖拽播放指针 | Ctrl+拖拽框选 | Shift+点击多选 | Ctrl+A全选 | Ctrl+D复制 | Delete删除 | Space 播放/暂停/录制放置 | 滚轮滚动 | Ctrl+滚轮缩放
      </span>
    </div>

    <!-- Save confirmation toast -->
    <Transition name="toast-fade">
      <div v-if="saveMessage" class="save-toast">{{ saveMessage }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.editor-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a0a2e 0%, #241245 50%, #1a0a2e 100%);
  overflow: hidden;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-title {
  font-size: 16px;
  font-weight: 700;
  color: #ff6b9d;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.15);
}

.metadata-inputs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-input {
  padding: 3px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  font-size: 12px;
  outline: none;
  transition: border-color 0.2s;
}

.meta-input:focus {
  border-color: #ff6b9d;
}

.meta-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.meta-title {
  width: 100px;
}

.meta-artist {
  width: 80px;
}

.meta-level {
  width: 44px;
  text-align: center;
}

.meta-select {
  padding: 3px 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  font-size: 12px;
  outline: none;
  cursor: pointer;
}

.note-types {
  display: flex;
  gap: 4px;
}

.note-type-btn {
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.note-type-btn.active {
  background: rgba(255, 255, 255, 0.1);
}

.track-switch {
  display: flex;
  gap: 4px;
}

.track-btn {
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.track-btn.active {
  border-color: #ff6b9d;
  background: rgba(255, 107, 157, 0.15);
  color: #ff6b9d;
}

.bpm-input {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.bpm-input input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  font-size: 12px;
  outline: none;
}

.bpm-input input:focus {
  border-color: #ff6b9d;
}

select {
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  font-size: 12px;
  outline: none;
  cursor: pointer;
}

.tool-btn {
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tool-btn.active {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.15);
  color: #ffd700;
}

.save-source {
  font-size: 10px;
  opacity: 0.7;
}

.playback-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.play-btn {
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
}

.play-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.time-display {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  font-family: monospace;
}

.note-count {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  margin-left: auto;
}

.selected-count {
  font-size: 13px;
  color: #4da6ff;
  font-weight: 600;
}

.editor-main {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.timeline-canvas {
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.status-info {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
}

.save-toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: #22c55e;
  color: #ffffff;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.toast-fade-enter-active {
  animation: toastFadeIn 0.3s ease;
}

.toast-fade-leave-active {
  animation: toastFadeIn 0.3s ease reverse;
}

@keyframes toastFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>

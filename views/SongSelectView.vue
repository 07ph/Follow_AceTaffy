<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import type { Chart } from '../types'
import { demoChart } from '../data/demoChart'
import ParticleBackground from '../components/ParticleBackground.vue'

const STORAGE_KEY = 'rhythm-pulse-songs'
const CHART_VERSION = 'v2' // bump to reset cached songs with new chart

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
const gameStore = useGameStore()

const songs = ref<(Chart & { id: string })[]>([])
const showUpload = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Edit song name state
const editingId = ref<string | null>(null)
const editTitle = ref('')
const editArtist = ref('')

function loadSongs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]._version === CHART_VERSION) {
        // 过滤掉无效歌曲（必须有 notes 数组）
        songs.value = parsed.filter((s: any) => s.notes && Array.isArray(s.notes) && s.notes.length > 0)
        if (songs.value.length > 0) return
      }
    }
  } catch {
    // ignore parse errors
  }
  songs.value = [{ ...demoChart, id: 'demo', _version: CHART_VERSION, audioUrl: '/demo-song.m4a' }]
  saveSongs()
}

function saveSongs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs.value))
}

async function selectSong(song: Chart & { id: string; audioUrl?: string }) {
  gameStore.resetGame()
  gameStore.setChart(song)
  const audioKey = `song-${song.id}`
  localStorage.setItem('rhythm-pulse-game-audio-key', audioKey)

  // If song has an audioUrl, fetch and store in IndexedDB
  if (song.audioUrl) {
    try {
      const response = await fetch(song.audioUrl)
      const arrayBuffer = await response.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)
      const ext = song.audioUrl.split('.').pop() || 'm4a'
      const dataUrl = `data:audio/${ext};base64,${base64}`
      await saveAudioToDB(audioKey, dataUrl)
    } catch (e) {
      console.warn('Failed to preload audio:', e)
    }
  }

  router.push('/game')
}

function editSong(song: Chart & { id: string }) {
  localStorage.setItem('rhythm-pulse-editing-id', song.id)
  router.push('/editor')
}

function deleteSong(id: string) {
  songs.value = songs.value.filter(s => s.id !== id)
  saveSongs()
}

function startEditSong(song: Chart & { id: string }) {
  editingId.value = song.id
  editTitle.value = song.title || ''
  editArtist.value = song.artist || ''
}

function cancelEditSong() {
  editingId.value = null
  editTitle.value = ''
  editArtist.value = ''
}

function saveEditSong() {
  if (!editingId.value) return
  const song = songs.value.find(s => s.id === editingId.value)
  if (song) {
    song.title = editTitle.value || '自定义谱面'
    song.artist = editArtist.value
    saveSongs()
  }
  editingId.value = null
}

function uploadChart() {
  fileInput.value?.click()
}

function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // 检查文件扩展名
  if (!file.name.endsWith('.json')) {
    alert('请上传 .json 格式的谱面文件，不要上传 package.json 等其他 JSON 文件。')
    target.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const chart = JSON.parse(reader.result as string) as Chart
      // 验证是否为有效谱面（必须有 notes 数组，防止误传 package.json 等）
      if (!chart.notes || !Array.isArray(chart.notes) || chart.notes.length === 0) {
        alert('无效的谱面文件：缺少 notes 数组或 notes 为空。请勿上传 package.json 等非谱面文件。')
        return
      }
      const id = 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
      const title = chart.title || '自定义谱面'
      songs.value.push({ ...chart, id, title: title, artist: chart.artist || '' })
      saveSongs()
    } catch {
      alert('无法解析 JSON 文件，请检查格式是否正确。')
    }
  }
  reader.readAsText(file)

  // reset input so the same file can be re-uploaded
  target.value = ''
}

onMounted(async () => {
  loadSongs()
  // 预加载默认歌曲的音频到 IndexedDB
  const demoKey = 'song-demo'
  try {
    const existing = await loadAudioFromDB(demoKey)
    if (!existing) {
      const response = await fetch('/demo-song.m4a')
      const arrayBuffer = await response.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)
      const dataUrl = `data:audio/m4a;base64,${base64}`
      await saveAudioToDB(demoKey, dataUrl)
    }
  } catch (e) {
    console.warn('预加载默认音频失败:', e)
  }
})
</script>

<template>
  <div class="page-container">
    <ParticleBackground />
    <div class="song-select-content">
      <h1 class="page-title">选择歌曲</h1>

      <div class="actions-bar">
        <button class="btn btn-upload" @click="uploadChart">📤 上传谱面 JSON</button>
        <button class="btn btn-back" @click="router.push('/')">🏠 返回主页</button>
      </div>

      <div class="song-grid" v-if="songs.length > 0">
        <div
          v-for="song in songs"
          :key="song.id"
          class="song-card"
          @click="selectSong(song)"
        >
          <div class="card-header">
            <span class="card-title">{{ song.title }}</span>
            <span class="card-difficulty" :class="'diff-' + song.difficulty.toLowerCase()">
              {{ song.difficulty }}
            </span>
          </div>
          <div class="card-meta">
            <span class="meta-item">🎵 {{ song.artist }}</span>
            <span class="meta-item">♩ BPM {{ song.bpm }}</span>
          </div>
          <div class="card-footer">
            <span class="level-badge">⭐ Lv.{{ song.level }}</span>
            <span class="note-count">♪ {{ song.notes.length }} notes</span>
          </div>
          <div class="card-actions" @click.stop>
            <button class="action-btn edit-name-btn" @click="startEditSong(song)" title="编辑名称">📝</button>
            <button class="action-btn edit-btn" @click="editSong(song)" title="编辑谱面">✏️</button>
            <button class="action-btn delete-btn" @click="deleteSong(song.id)" title="删除">✕</button>
          </div>
          <!-- Inline edit form -->
          <div v-if="editingId === song.id" class="edit-form" @click.stop>
            <input
              type="text"
              v-model="editTitle"
              class="edit-input"
              placeholder="歌曲标题"
            />
            <input
              type="text"
              v-model="editArtist"
              class="edit-input"
              placeholder="艺术家"
            />
            <div class="edit-form-actions">
              <button class="edit-save-btn" @click="saveEditSong">保存</button>
              <button class="edit-cancel-btn" @click="cancelEditSong">取消</button>
            </div>
          </div>
        </div>
      </div>

      <div class="empty-state" v-else>
        <p>暂无歌曲，请上传谱面 JSON 文件。</p>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept=".json"
        style="display: none"
        @change="handleFileUpload"
      />
    </div>
  </div>
</template>

<style scoped>
.page-container {
  width: 100vw;
  height: 100vh;
  overflow-y: auto;
  background: #0a0a0f;
  position: relative;
}

.song-select-content {
  position: relative;
  z-index: 1;
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 20px 60px;
}

.page-title {
  font-size: 48px;
  font-weight: 900;
  text-align: center;
  margin: 0 0 32px;
  background: linear-gradient(135deg, #ff6b9d, #c44dff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 20px rgba(255, 107, 157, 0.3));
}

.actions-bar {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 24px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  font-family: inherit;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.btn-upload {
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.2), rgba(196, 77, 255, 0.2));
  border-color: rgba(255, 107, 157, 0.4);
  color: #ff6b9d;
  font-weight: 600;
}

.btn-upload:hover {
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.35), rgba(196, 77, 255, 0.35));
  border-color: #ff6b9d;
  box-shadow: 0 0 20px rgba(255, 107, 157, 0.2);
}

.btn-back {
  color: rgba(255, 255, 255, 0.7);
}

.song-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.song-card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.25s ease;
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}

.song-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #ff6b9d, #c44dff);
  opacity: 0;
  transition: opacity 0.25s ease;
}

.song-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 107, 157, 0.4);
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(255, 107, 157, 0.15), 0 0 40px rgba(196, 77, 255, 0.08);
}

.song-card:hover::before {
  opacity: 1;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 8px;
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-difficulty {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}

.diff-normal {
  background: rgba(77, 201, 246, 0.2);
  color: #4dc9f6;
  border: 1px solid rgba(77, 201, 246, 0.3);
}

.diff-easy {
  background: rgba(76, 217, 100, 0.2);
  color: #4cd964;
  border: 1px solid rgba(76, 217, 100, 0.3);
}

.diff-hard {
  background: rgba(255, 149, 0, 0.2);
  color: #ff9500;
  border: 1px solid rgba(255, 149, 0, 0.3);
}

.diff-expert {
  background: rgba(255, 59, 48, 0.2);
  color: #ff3b30;
  border: 1px solid rgba(255, 59, 48, 0.3);
}

.diff-master {
  background: rgba(196, 77, 255, 0.2);
  color: #c44dff;
  border: 1px solid rgba(196, 77, 255, 0.3);
}

.card-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.level-badge {
  font-size: 14px;
  font-weight: 600;
  color: #ffd700;
}

.note-count {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.card-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 12px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.song-card:hover .card-actions {
  opacity: 1;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  backdrop-filter: blur(8px);
}

.edit-btn {
  background: rgba(196, 77, 255, 0.3);
  color: #c44dff;
}

.edit-btn:hover {
  background: rgba(196, 77, 255, 0.5);
  transform: scale(1.1);
}

.delete-btn {
  background: rgba(255, 59, 48, 0.3);
  color: #ff3b30;
}

.delete-btn:hover {
  background: rgba(255, 59, 48, 0.5);
  transform: scale(1.1);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 16px;
}

.empty-state p {
  margin: 0;
}

.edit-name-btn {
  background: rgba(255, 215, 0, 0.3);
  color: #ffd700;
}

.edit-name-btn:hover {
  background: rgba(255, 215, 0, 0.5);
  transform: scale(1.1);
}

.edit-form {
  margin-top: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.edit-input {
  width: 100%;
  padding: 6px 10px;
  margin-bottom: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.edit-input:focus {
  border-color: #ff6b9d;
}

.edit-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.edit-form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.edit-save-btn {
  padding: 5px 16px;
  border: none;
  border-radius: 6px;
  background: #22c55e;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-save-btn:hover {
  background: #16a34a;
}

.edit-cancel-btn {
  padding: 5px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-cancel-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

@media (max-width: 640px) {
  .page-title {
    font-size: 32px;
  }

  .song-select-content {
    padding: 24px 16px 40px;
  }

  .song-grid {
    grid-template-columns: 1fr;
  }

  .card-actions {
    opacity: 1;
  }
}
</style>

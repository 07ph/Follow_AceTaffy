<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings'
import ParticleBackground from '../components/ParticleBackground.vue'

const router = useRouter()
const settings = useSettingsStore()

const calibrationStep = ref(0) // 0: 视觉, 1: 音频, 2: 手动
const globalOffset = ref(Math.round(settings.offset * 1000))
const inputOffset = ref(Math.round(settings.inputOffset * 1000))

// === 视觉校准 ===
const isVisualCalibrating = ref(false)
const visualTapTimes: number[] = []
const visualBeatTimes: number[] = []
const visualResult = ref<number | null>(null)
let visualAudioCtx: AudioContext | null = null
let visualAnimId = 0
const visualBeatFlash = ref(false)

function startVisualCalibration() {
  visualTapTimes.length = 0
  visualBeatTimes.length = 0
  visualResult.value = null
  isVisualCalibrating.value = true

  visualAudioCtx = null // 输入校准不播放声音

  const totalBeats = 8
  const startTime = performance.now() + 1500 // 1.5秒后开始

  // 预计算节拍时间（随机间隔 800-1500ms）
  let t = startTime
  for (let i = 0; i < totalBeats; i++) {
    visualBeatTimes.push(t)
    t += 800 + Math.random() * 700
  }

  // 节拍闪烁动画
  let lastBeatIndex = -1
  function flashLoop() {
    const now = performance.now()
    const currentBeatIndex = visualBeatTimes.findIndex(t => Math.abs(now - t) < 150)
    if (currentBeatIndex !== -1 && currentBeatIndex !== lastBeatIndex) {
      lastBeatIndex = currentBeatIndex
      visualBeatFlash.value = true
      setTimeout(() => { visualBeatFlash.value = false }, 150)
    }
    if (isVisualCalibrating.value) {
      visualAnimId = requestAnimationFrame(flashLoop)
    }
  }
  visualAnimId = requestAnimationFrame(flashLoop)

  // 结束校准
  const totalTime = visualBeatTimes[totalBeats - 1] - startTime + 1500
  setTimeout(() => {
    finishVisualCalibration()
  }, totalTime)
}

function beatTimeForIndex(i: number): number {
  return visualBeatTimes[i] || (performance.now() + 1000 + i * 500)
}

function playClick(audioCtx: AudioContext | null, delay: number, accent: boolean) {
  if (!audioCtx) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.frequency.value = accent ? 1000 : 800
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime + delay)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.08)
  osc.start(audioCtx.currentTime + delay)
  osc.stop(audioCtx.currentTime + delay + 0.1)
}

function recordVisualTap() {
  if (!isVisualCalibrating.value) return
  visualTapTimes.push(performance.now())
}

function finishVisualCalibration() {
  isVisualCalibrating.value = false
  cancelAnimationFrame(visualAnimId)
  if (visualAudioCtx) {
    visualAudioCtx.close()
    visualAudioCtx = null
  }

  if (visualTapTimes.length < 3) {
    visualResult.value = null
    return
  }

  // 计算平均偏移：每个 tap 找到最近的 beat，计算差值
  const offsets: number[] = []
  for (const tapTime of visualTapTimes) {
    let minDiff = Infinity
    for (const beatTime of visualBeatTimes) {
      const diff = tapTime - beatTime
      if (Math.abs(diff) < Math.abs(minDiff)) {
        minDiff = diff
      }
    }
    offsets.push(minDiff)
  }

  // 去掉最大最小值后取平均
  offsets.sort((a, b) => a - b)
  const trimmed = offsets.length > 4
    ? offsets.slice(1, -1)
    : offsets
  const avgOffset = trimmed.reduce((s, v) => s + v, 0) / trimmed.length

  visualResult.value = Math.round(avgOffset)
}

function applyVisualResult() {
  if (visualResult.value === null) return
  inputOffset.value = visualResult.value
  settings.setInputOffset(visualResult.value / 1000)
}

// === 音频校准 ===
const isAudioCalibrating = ref(false)
const audioTapTimes: number[] = []
const audioBeatTimes: number[] = []
const audioResult = ref<number | null>(null)
let audioAudioCtx: AudioContext | null = null
let audioAnimId = 0
const audioBeatFlash = ref(false)
const audioBeatCount = ref(0)

function startAudioCalibration() {
  audioTapTimes.length = 0
  audioBeatTimes.length = 0
  audioResult.value = null
  audioBeatCount.value = 0
  isAudioCalibrating.value = true

  audioAudioCtx = new AudioContext()

  const totalBeats = 8
  const startTime = performance.now() + 1500

  // 随机间隔 800-1500ms
  let t = startTime
  for (let i = 0; i < totalBeats; i++) {
    audioBeatTimes.push(t)
    t += 800 + Math.random() * 700
  }

  // 播放节拍
  for (let i = 0; i < totalBeats; i++) {
    const delay = (audioBeatTimes[i] - performance.now()) / 1000
    if (delay > 0) {
      playClick(audioAudioCtx, delay, i === 0 || i === 4)
    }
  }

  // 节拍闪烁
  let lastBeatIndex = -1
  function flashLoop() {
    const now = performance.now()
    const idx = audioBeatTimes.findIndex(t => Math.abs(now - t) < 150)
    if (idx !== -1 && idx !== lastBeatIndex) {
      lastBeatIndex = idx
      audioBeatCount.value = idx + 1
      audioBeatFlash.value = true
      setTimeout(() => { audioBeatFlash.value = false }, 150)
    }
    if (isAudioCalibrating.value) {
      audioAnimId = requestAnimationFrame(flashLoop)
    }
  }
  audioAnimId = requestAnimationFrame(flashLoop)

  const totalTime = audioBeatTimes[totalBeats - 1] - startTime + 2000
  setTimeout(() => {
    finishAudioCalibration()
  }, totalTime)
}

function recordAudioTap() {
  if (!isAudioCalibrating.value) return
  audioTapTimes.push(performance.now())
}

function finishAudioCalibration() {
  isAudioCalibrating.value = false
  cancelAnimationFrame(audioAnimId)
  if (audioAudioCtx) {
    audioAudioCtx.close()
    audioAudioCtx = null
  }

  if (audioTapTimes.length < 3) {
    audioResult.value = null
    return
  }

  const offsets: number[] = []
  for (const tapTime of audioTapTimes) {
    let minDiff = Infinity
    for (const beatTime of audioBeatTimes) {
      const diff = tapTime - beatTime
      if (Math.abs(diff) < Math.abs(minDiff)) {
        minDiff = diff
      }
    }
    offsets.push(minDiff)
  }

  offsets.sort((a, b) => a - b)
  const trimmed = offsets.length > 4 ? offsets.slice(1, -1) : offsets
  const avgOffset = trimmed.reduce((s, v) => s + v, 0) / trimmed.length

  audioResult.value = Math.round(avgOffset)
}

function applyAudioResult() {
  if (audioResult.value === null) return
  globalOffset.value = audioResult.value
  settings.setOffset(audioResult.value / 1000)
}

// === 手动调整 ===
function onGlobalOffsetChange() {
  settings.setOffset(globalOffset.value / 1000)
}

function onInputOffsetChange() {
  settings.setInputOffset(inputOffset.value / 1000)
}

function resetOffsets() {
  globalOffset.value = 0
  inputOffset.value = 0
  settings.setOffset(0)
  settings.setInputOffset(0)
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space') {
    e.preventDefault()
    recordVisualTap()
    recordAudioTap()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  cancelAnimationFrame(visualAnimId)
  cancelAnimationFrame(audioAnimId)
  if (visualAudioCtx) visualAudioCtx.close()
  if (audioAudioCtx) audioAudioCtx.close()
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="page-container">
    <ParticleBackground />
    <div class="calibration-content">
      <h1 class="page-title fade-in">校准</h1>

      <!-- 步骤选择 -->
      <div class="step-tabs fade-in fade-in-delay-1">
        <button class="step-tab" :class="{ active: calibrationStep === 0 }" @click="calibrationStep = 0">
          👁️ 输入校准
        </button>
        <button class="step-tab" :class="{ active: calibrationStep === 1 }" @click="calibrationStep = 1">
          🔊 音频校准
        </button>
        <button class="step-tab" :class="{ active: calibrationStep === 2 }" @click="calibrationStep = 2">
          🔧 手动调整
        </button>
      </div>

      <!-- 输入校准 -->
      <div v-if="calibrationStep === 0" class="calibration-panel fade-in fade-in-delay-2">
        <p class="calibration-desc">
          测试你的反应速度。点击"开始"后会播放节拍器，<strong>看到画面闪烁时立即按空格键</strong>。<br/>
          系统会计算你的平均反应延迟，自动补偿输入偏移。<br/>
          <span class="calibration-warn">⚠️ 校准测试不一定准确，也可以在"手动调整"中微调</span>
        </p>

        <!-- 节拍可视化 -->
        <div class="beat-visual" :class="{ flash: visualBeatFlash }">
          <div class="beat-circle" />
          <span class="beat-label">节拍</span>
        </div>

        <div class="calibration-actions">
          <button
            class="btn btn-gold"
            @click="startVisualCalibration"
            :disabled="isVisualCalibrating"
          >
            {{ isVisualCalibrating ? '👀 看到闪烁按空格...' : '开始校准' }}
          </button>
        </div>

        <div v-if="isVisualCalibrating && visualTapTimes.length > 0" class="calibration-result">
          <p>已记录 <strong>{{ visualTapTimes.length }}</strong> 次按键</p>
        </div>

        <div v-if="visualResult !== null" class="calibration-result success">
          <p>校准完成！平均延迟: <strong>{{ visualResult }}ms</strong></p>
          <p class="result-hint">{{ visualResult > 0 ? '你的反应偏慢，已自动补偿' : visualResult < 0 ? '你的反应偏快，已自动补偿' : '你的反应非常精准！' }}</p>
          <button class="btn btn-gold btn-small" @click="applyVisualResult">应用结果</button>
        </div>

        <div v-if="!isVisualCalibrating && visualResult === null && visualTapTimes.length > 0" class="calibration-result warn">
          <p>按键次数不足，请重新校准（至少需要3次）</p>
        </div>
      </div>

      <!-- 音频校准 -->
      <div v-if="calibrationStep === 1" class="calibration-panel fade-in fade-in-delay-2">
        <p class="calibration-desc">
          测试音频同步。点击"开始"后会播放节拍器，<strong>听到声音时按空格键</strong>。<br/>
          系统会计算音频与视觉的延迟差，自动调整全局偏移。<br/>
          <span class="calibration-warn">⚠️ 校准测试不一定准确，也可以在"手动调整"中微调</span>
        </p>

        <div class="beat-visual" :class="{ flash: audioBeatFlash }">
          <div class="beat-circle" />
          <span class="beat-label">节拍 {{ audioBeatCount }} / 8</span>
        </div>

        <div class="calibration-actions">
          <button
            class="btn btn-gold"
            @click="startAudioCalibration"
            :disabled="isAudioCalibrating"
          >
            {{ isAudioCalibrating ? '🎵 听到节拍按空格...' : '开始校准' }}
          </button>
        </div>

        <div v-if="isAudioCalibrating && audioTapTimes.length > 0" class="calibration-result">
          <p>已记录 <strong>{{ audioTapTimes.length }}</strong> 次按键</p>
        </div>

        <div v-if="audioResult !== null" class="calibration-result success">
          <p>校准完成！音频偏移: <strong>{{ audioResult }}ms</strong></p>
          <p class="result-hint">{{ audioResult > 0 ? '音频比视觉快，已自动补偿' : audioResult < 0 ? '音频比视觉慢，已自动补偿' : '音频与视觉完全同步！' }}</p>
          <button class="btn btn-gold btn-small" @click="applyAudioResult">应用结果</button>
        </div>
      </div>

      <!-- 手动调整 -->
      <div v-if="calibrationStep === 2" class="calibration-panel fade-in fade-in-delay-2">
        <p class="calibration-desc">
          手动微调偏移量。正值 = 提前，负值 = 延迟。
        </p>

        <div class="setting-item">
          <label class="setting-label">全局偏移（音频同步）</label>
          <div class="setting-control">
            <input type="range" min="-200" max="200" v-model.number="globalOffset" @input="onGlobalOffsetChange" class="slider" />
            <span class="setting-value">{{ globalOffset }}ms</span>
          </div>
          <p class="setting-hint">调整音符出现时机与音乐的同步</p>
        </div>

        <div class="setting-item">
          <label class="setting-label">输入偏移（反应补偿）</label>
          <div class="setting-control">
            <input type="range" min="-200" max="200" v-model.number="inputOffset" @input="onInputOffsetChange" class="slider" />
            <span class="setting-value">{{ inputOffset }}ms</span>
          </div>
          <p class="setting-hint">补偿你的按键反应时间</p>
        </div>

        <div class="calibration-actions">
          <button class="btn btn-small" @click="resetOffsets">重置为 0</button>
        </div>
      </div>

      <div class="offset-summary fade-in fade-in-delay-3">
        <span>当前: 全局 {{ globalOffset }}ms | 输入 {{ inputOffset }}ms</span>
      </div>

      <button class="btn fade-in fade-in-delay-3" @click="router.push('/')">🏠 返回主页</button>
    </div>
  </div>
</template>

<style scoped>
.calibration-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px;
  max-width: 520px;
  width: 100%;
}

.page-title {
  font-size: 36px;
  font-weight: 700;
  color: #ff6b9d;
  margin: 0;
  filter: drop-shadow(0 0 15px rgba(255, 107, 157, 0.3));
}

.step-tabs {
  display: flex;
  gap: 8px;
}

.step-tab {
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.step-tab.active {
  border-color: #ff6b9d;
  background: rgba(255, 107, 157, 0.15);
  color: #ff6b9d;
}

.calibration-panel {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 157, 0.2);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(10px);
}

.calibration-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.8;
  margin-bottom: 16px;
}

.calibration-desc strong {
  color: #ff6b9d;
}

/* 节拍可视化 */
.beat-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
  padding: 20px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.1s;
}

.beat-visual.flash {
  background: rgba(255, 107, 157, 0.15);
  border-color: rgba(255, 107, 157, 0.5);
}

.beat-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255, 107, 157, 0.15);
  border: 2px solid rgba(255, 107, 157, 0.4);
  transition: all 0.1s;
}

.beat-visual.flash .beat-circle {
  background: rgba(255, 107, 157, 0.6);
  border-color: #ff6b9d;
  box-shadow: 0 0 30px rgba(255, 107, 157, 0.5);
  transform: scale(1.1);
}

.beat-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.calibration-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.calibration-result {
  text-align: center;
  margin-top: 12px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

.calibration-result.success {
  color: rgba(255, 255, 255, 0.8);
}

.calibration-result.success strong {
  color: #ffd700;
  font-size: 20px;
}

.result-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}

.calibration-warn {
  font-size: 12px;
  color: rgba(255, 200, 100, 0.7);
}

.calibration-result.warn {
  color: rgba(255, 200, 100, 0.8);
}

.btn-small {
  margin-top: 8px;
  padding: 6px 16px;
  font-size: 13px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.setting-label {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.setting-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  margin: 0;
}

.slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ff6b9d;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(255, 107, 157, 0.5);
}

.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ff6b9d;
  cursor: pointer;
  border: none;
  box-shadow: 0 0 10px rgba(255, 107, 157, 0.5);
}

.setting-value {
  min-width: 60px;
  text-align: right;
  font-size: 14px;
  color: #ff6b9d;
  font-weight: 600;
}

.offset-summary {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  padding: 8px 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}
</style>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ref, onMounted, onUnmounted, watch } from 'vue'
import ParticleBackground from '../components/ParticleBackground.vue'
import { useSettingsStore } from '../stores/settings'

const router = useRouter()
const settings = useSettingsStore()

function openEditor() {
  localStorage.removeItem('rhythm-pulse-editing-id')
  router.push('/editor')
}

// === 弹跳 GIF 系统 ===
interface BouncingEntity {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  isMeteor: boolean
  opacity: number
  rotation: number
  rotationSpeed: number
}

const entities = ref<BouncingEntity[]>([])
let nextId = 0
let bounceAnimId = 0
const MAX_ENTITIES = 12
const SPLIT_CHANCE = 0.35
const MIN_SPLIT_SIZE = 35
const METEOR_THRESHOLD = 8

function createEntity(x: number, y: number, size: number, vx?: number, vy?: number): BouncingEntity {
  return {
    id: nextId++,
    x, y, size,
    vx: vx ?? (2 + Math.random() * 3) * (Math.random() > 0.5 ? 1 : -1),
    vy: vy ?? (2 + Math.random() * 3) * (Math.random() > 0.5 ? 1 : -1),
    isMeteor: false,
    opacity: 1,
    rotation: 0,
    rotationSpeed: (Math.random() - 0.5) * 4
  }
}

function onTafiClick(event: MouseEvent) {
  if (entities.value.length > 0) {
    // 找到点击的那个实体，只给它加速
    const target = event.target as HTMLElement
    const id = target.dataset.entityId
    if (id) {
      const entity = entities.value.find(e => e.id === Number(id))
      if (entity && !entity.isMeteor) {
        entity.vx = (3 + Math.random() * 4) * (entity.vx > 0 ? 1 : -1)
        entity.vy = (3 + Math.random() * 4) * (entity.vy > 0 ? 1 : -1)
      }
    }
    return
  }

  // 初始：从页面内容流位置开始
  const el = document.querySelector('.tafi-gif-main') as HTMLElement
  const rect = el?.getBoundingClientRect()
  const startX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  const startY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2

  entities.value.push(createEntity(startX, startY, 120))
}

function splitEntity(entity: BouncingEntity) {
  if (entities.value.length >= MAX_ENTITIES) return
  if (entity.size < MIN_SPLIT_SIZE) return

  const newSize = entity.size * 0.65
  const offsetAngle = Math.random() * Math.PI * 2
  const offsetDist = 10

  const child1 = createEntity(
    entity.x + Math.cos(offsetAngle) * offsetDist,
    entity.y + Math.sin(offsetAngle) * offsetDist,
    newSize,
    entity.vx + (Math.random() - 0.5) * 2,
    entity.vy + (Math.random() - 0.5) * 2
  )
  const child2 = createEntity(
    entity.x - Math.cos(offsetAngle) * offsetDist,
    entity.y - Math.sin(offsetAngle) * offsetDist,
    newSize,
    entity.vx + (Math.random() - 0.5) * 2,
    entity.vy + (Math.random() - 0.5) * 2
  )

  entities.value.push(child1, child2)
}

function animate() {
  const cw = window.innerWidth
  const ch = window.innerHeight
  const toRemove: number[] = []

  for (const e of entities.value) {
    if (e.isMeteor) {
      // 流星模式：直线飞行，逐渐消失
      e.x += e.vx * 2
      e.y += e.vy * 2
      e.opacity -= 0.008
      e.rotation += e.rotationSpeed * 2

      if (e.opacity <= 0 || e.x < -200 || e.x > cw + 200 || e.y < -200 || e.y > ch + 200) {
        toRemove.push(e.id)
      }
      continue
    }

    e.x += e.vx
    e.y += e.vy
    e.rotation += e.rotationSpeed

    // 估算尺寸（宽高比约 1:1）
    const halfSize = e.size / 2
    let bounced = false

    if (e.x - halfSize <= 0) { e.x = halfSize; e.vx = Math.abs(e.vx); bounced = true }
    if (e.x + halfSize >= cw) { e.x = cw - halfSize; e.vx = -Math.abs(e.vx); bounced = true }
    if (e.y - halfSize <= 0) { e.y = halfSize; e.vy = Math.abs(e.vy); bounced = true }
    if (e.y + halfSize >= ch) { e.y = ch - halfSize; e.vy = -Math.abs(e.vy); bounced = true }

    // 碰壁时概率分裂
    if (bounced && Math.random() < SPLIT_CHANCE && entities.value.length < MAX_ENTITIES) {
      splitEntity(e)
    }

    // 实体太多时，最小的变成流星
    if (entities.value.length >= METEOR_THRESHOLD) {
      const nonMeteors = entities.value.filter(en => !en.isMeteor)
      if (nonMeteors.length >= METEOR_THRESHOLD) {
        // 找最小的变成流星
        const smallest = nonMeteors.reduce((a, b) => a.size < b.size ? a : b)
        smallest.isMeteor = true
        smallest.vx = (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 4)
        smallest.vy = -3 - Math.random() * 4
        smallest.rotationSpeed = (Math.random() - 0.5) * 10
      }
    }

    // 逐渐减速
    e.vx *= 0.9995
    e.vy *= 0.9995
  }

  // 移除消失的流星
  if (toRemove.length > 0) {
    entities.value = entities.value.filter(e => !toRemove.includes(e.id))
  }

  bounceAnimId = requestAnimationFrame(animate)
}

// === 主页 BGM ===
let bgmAudio: HTMLAudioElement | null = null

function initBgm() {
  if (!settings.homeBgm) return
  bgmAudio = new Audio('/home-bgm.m4a')
  bgmAudio.loop = true
  bgmAudio.volume = settings.bgmVolume * 0.5
  bgmAudio.play().catch(() => {
    document.addEventListener('click', function tryPlay() {
      bgmAudio?.play().catch(() => {})
      document.removeEventListener('click', tryPlay)
    }, { once: true })
  })
}

function stopBgm() {
  if (bgmAudio) {
    bgmAudio.pause()
    bgmAudio.currentTime = 0
    bgmAudio = null
  }
}

watch(() => settings.bgmVolume, (v) => {
  if (bgmAudio) bgmAudio.volume = v * 0.5
})

watch(() => settings.homeBgm, (v) => {
  if (v && !bgmAudio) initBgm()
  else if (!v && bgmAudio) stopBgm()
})

onMounted(() => {
  initBgm()
  bounceAnimId = requestAnimationFrame(animate)
})

onUnmounted(() => {
  cancelAnimationFrame(bounceAnimId)
  stopBgm()
})
</script>

<template>
  <div class="page-container">
    <ParticleBackground />
    <div class="home-content">
      <img
        v-if="entities.length === 0"
        src="/yctf.gif"
        alt="永雏塔菲"
        class="tafi-gif-main fade-in"
        draggable="false"
        @click="onTafiClick"
        @dragstart.prevent
      />
      <p class="subtitle fade-in fade-in-delay-1">关注塔菲谢谢喵 ✨</p>

      <div class="nav-buttons fade-in fade-in-delay-2">
        <button class="btn btn-gold" @click="router.push('/select')">🎮 开始游戏</button>
        <button class="btn btn-purple" @click="openEditor()">📝 谱面编辑器</button>
        <button class="btn" @click="router.push('/settings')">⚙️ 设置</button>
        <button class="btn" @click="router.push('/calibration')">🎯 校准</button>
      </div>
    </div>

    <!-- 弹跳的小菲们 -->
    <img
      v-for="e in entities"
      :key="e.id"
      src="/yctf.gif"
      alt="塔菲"
      class="bouncing-tafi"
      :class="{ meteor: e.isMeteor }"
      :data-entity-id="e.id"
      :style="{
        left: (e.x - e.size / 2) + 'px',
        top: (e.y - e.size / 2) + 'px',
        width: e.size + 'px',
        height: e.size + 'px',
        opacity: e.opacity,
        transform: 'rotate(' + e.rotation + 'deg)',
        zIndex: e.isMeteor ? 60 : 50
      }"
      draggable="false"
      @click="onTafiClick"
      @dragstart.prevent
    />
  </div>
</template>

<style scoped>
.home-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.tafi-gif-main {
  height: 120px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 20px rgba(255, 107, 157, 0.3));
  cursor: pointer;
}

.subtitle {
  font-size: 22px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

.nav-buttons {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.bouncing-tafi {
  position: fixed;
  object-fit: contain;
  pointer-events: auto;
  cursor: pointer;
  filter: drop-shadow(0 0 10px rgba(255, 107, 157, 0.4));
  transition: filter 0.2s;
}

.bouncing-tafi.meteor {
  pointer-events: none;
  filter: drop-shadow(0 0 15px rgba(255, 200, 100, 0.6));
}
</style>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ref, onMounted, onUnmounted } from 'vue'
import ParticleBackground from '../components/ParticleBackground.vue'

const router = useRouter()

function openEditor() {
  localStorage.removeItem('rhythm-pulse-editing-id')
  router.push('/editor')
}

// === 弹跳 GIF ===
const tafiGif = ref<HTMLImageElement | null>(null)
let bounceAnimId = 0
let isBouncing = false

function startBouncing() {
  const el = tafiGif.value
  if (!el || isBouncing) return
  isBouncing = true

  // 切换到 fixed 定位，保持当前视觉位置
  const rect = el.getBoundingClientRect()
  el.style.position = 'fixed'
  el.style.left = rect.left + 'px'
  el.style.top = rect.top + 'px'
  el.style.zIndex = '50'
  el.style.margin = '0'

  const gifW = el.offsetWidth
  const gifH = el.offsetHeight

  let x = rect.left
  let y = rect.top
  let vx = (3 + Math.random() * 3) * (Math.random() > 0.5 ? 1 : -1)
  let vy = (3 + Math.random() * 3) * (Math.random() > 0.5 ? 1 : -1)

  function animate() {
    const cw = window.innerWidth
    const ch = window.innerHeight

    x += vx
    y += vy

    if (x <= 0) { x = 0; vx = Math.abs(vx) }
    if (x >= cw - gifW) { x = cw - gifW; vx = -Math.abs(vx) }
    if (y <= 0) { y = 0; vy = Math.abs(vy) }
    if (y >= ch - gifH) { y = ch - gifH; vy = -Math.abs(vy) }

    el!.style.left = x + 'px'
    el!.style.top = y + 'px'

    vx *= 0.999
    vy *= 0.999

    if (Math.abs(vx) < 0.3 && Math.abs(vy) < 0.3) {
      isBouncing = false
      return
    }

    bounceAnimId = requestAnimationFrame(animate)
  }

  bounceAnimId = requestAnimationFrame(animate)
}

function onTafiClick() {
  if (isBouncing) {
    cancelAnimationFrame(bounceAnimId)
    isBouncing = false
  }
  startBouncing()
}

onUnmounted(() => {
  cancelAnimationFrame(bounceAnimId)
})
</script>

<template>
  <div class="page-container">
    <ParticleBackground />
    <div class="home-content">
      <img
        ref="tafiGif"
        src="/yctf.gif"
        alt="永雏塔菲"
        class="tafi-gif fade-in"
        @click="onTafiClick"
      />
      <p class="subtitle fade-in fade-in-delay-1">关注塔菲谢谢喵 ✨</p>

      <div class="nav-buttons fade-in fade-in-delay-2">
        <button class="btn btn-gold" @click="router.push('/select')">🎮 开始游戏</button>
        <button class="btn btn-purple" @click="openEditor()">📝 谱面编辑器</button>
        <button class="btn" @click="router.push('/settings')">⚙️ 设置</button>
        <button class="btn" @click="router.push('/calibration')">🎯 校准</button>
      </div>
    </div>
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

.tafi-gif {
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
</style>

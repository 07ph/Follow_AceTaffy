<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  (e: 'done'): void
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const show = ref(true)
let animId = 0

interface CharMeteor {
  char: string
  x: number
  y: number
  targetX: number
  targetY: number
  vx: number
  vy: number
  arrived: boolean
  arriveTime: number
  alpha: number
  scale: number
  trail: { x: number; y: number; alpha: number }[]
}

interface Sparkle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  radius: number
  color: string
}

const chars: CharMeteor[] = []
const sparkles: Sparkle[] = []
let phase = 'flying' // flying -> burst -> fadeout -> done
let phaseTime = 0
let burstTime = 0

const text = 'ACE TAFFY'

function init() {
  const cvs = canvas.value
  if (!cvs) return
  const w = cvs.width
  const h = cvs.height
  const centerX = w / 2
  const centerY = h / 2

  // 计算每个字符的目标位置
  const fontSize = Math.min(w * 0.12, 100)
  ctx_fontSize = fontSize
  const totalWidth = text.length * fontSize * 0.65
  const startX = centerX - totalWidth / 2

  chars.length = 0
  for (let i = 0; i < text.length; i++) {
    const targetX = startX + i * fontSize * 0.65 + fontSize * 0.325
    const targetY = centerY

    // 从屏幕外不同方向飞入
    const angle = (Math.PI * 2 * i) / text.length + Math.random() * 0.5
    const dist = Math.max(w, h) * 0.8

    chars.push({
      char: text[i],
      x: centerX + Math.cos(angle) * dist,
      y: centerY + Math.sin(angle) * dist,
      targetX,
      targetY,
      vx: 0,
      vy: 0,
      arrived: false,
      arriveTime: 0,
      alpha: 0,
      scale: 0.5,
      trail: []
    })
  }
}

let ctx_fontSize = 80

function spawnSparkles(x: number, y: number, count: number) {
  const colors = ['#ff6b9d', '#ffd700', '#c44dff', '#ff9ecf', '#ffffff']
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1 + Math.random() * 4
    sparkles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      radius: 1 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)]
    })
  }
}

function animate() {
  const cvs = canvas.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')
  if (!ctx) return

  const w = cvs.width
  const h = cvs.height

  ctx.clearRect(0, 0, w, h)
  phaseTime++

  if (phase === 'flying') {
    let allArrived = true
    for (const c of chars) {
      if (c.arrived) continue

      // 弹性运动飞向目标
      const dx = c.targetX - c.x
      const dy = c.targetY - c.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      c.vx += dx * 0.04
      c.vy += dy * 0.04
      c.vx *= 0.88
      c.vy *= 0.88
      c.x += c.vx
      c.y += c.vy

      c.alpha = Math.min(1, c.alpha + 0.03)
      c.scale = Math.min(1, c.scale + 0.02)

      // 添加拖尾
      c.trail.push({ x: c.x, y: c.y, alpha: 0.8 })
      if (c.trail.length > 12) c.trail.shift()

      if (dist < 2 && Math.abs(c.vx) < 0.5 && Math.abs(c.vy) < 0.5) {
        c.arrived = true
        c.arriveTime = phaseTime
        c.x = c.targetX
        c.y = c.targetY
        spawnSparkles(c.targetX, c.targetY, 15)
      } else {
        allArrived = false
      }
    }

    if (allArrived) {
      phase = 'burst'
      burstTime = phaseTime
      // 大爆发
      for (const c of chars) {
        spawnSparkles(c.targetX, c.targetY, 20)
      }
    }
  }

  if (phase === 'burst') {
    const elapsed = phaseTime - burstTime
    if (elapsed > 60) {
      phase = 'fadeout'
    }
  }

  if (phase === 'fadeout') {
    const fadeProgress = Math.min(1, (phaseTime - burstTime - 60) / 40)
    for (const c of chars) {
      c.alpha = Math.max(0, 1 - fadeProgress)
    }
    if (fadeProgress >= 1) {
      phase = 'done'
      show.value = false
      emit('done')
    }
  }

  // 绘制字符拖尾
  for (const c of chars) {
    for (let i = 0; i < c.trail.length; i++) {
      const t = c.trail[i]
      t.alpha *= 0.85
      if (t.alpha < 0.01) continue
      const progress = i / c.trail.length
      ctx.font = `${ctx_fontSize * c.scale * progress}px 'Arial Black', sans-serif`
      ctx.fillStyle = `rgba(255, 107, 157, ${t.alpha * 0.3 * c.alpha})`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(c.char, t.x, t.y)
    }
  }

  // 绘制字符
  for (const c of chars) {
    if (c.alpha <= 0) continue

    ctx.save()
    ctx.globalAlpha = c.alpha
    ctx.font = `900 ${ctx_fontSize * c.scale}px 'Arial Black', 'Microsoft YaHei', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 粉红色发光
    ctx.shadowColor = '#ff6b9d'
    ctx.shadowBlur = 20

    ctx.fillStyle = '#ff6b9d'
    ctx.fillText(c.char, c.x, c.y)
    ctx.restore()
  }

  // 绘制火花
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i]
    s.x += s.vx
    s.y += s.vy
    s.vy += 0.05 // 重力
    s.alpha -= 0.015
    s.vx *= 0.99

    if (s.alpha <= 0) {
      sparkles.splice(i, 1)
      continue
    }

    ctx.beginPath()
    ctx.arc(s.x, s.y, s.radius * s.alpha, 0, Math.PI * 2)
    ctx.fillStyle = s.color
    ctx.globalAlpha = s.alpha
    ctx.fill()
    ctx.globalAlpha = 1
  }

  if (phase !== 'done') {
    animId = requestAnimationFrame(animate)
  }
}

function resize() {
  const cvs = canvas.value
  if (!cvs) return
  cvs.width = window.innerWidth
  cvs.height = window.innerHeight
}

onMounted(() => {
  resize()
  init()
  animate()
  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas
    v-if="show"
    ref="canvas"
    style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:100;pointer-events:none;"
  />
</template>

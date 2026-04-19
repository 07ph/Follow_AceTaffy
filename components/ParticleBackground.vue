<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)
let animId = 0

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  alphaDir: number
}

interface Meteor {
  x: number
  y: number
  length: number
  speed: number
  angle: number
  alpha: number
  width: number
  life: number
  maxLife: number
}

const particles: Particle[] = []
const meteors: Meteor[] = []

function initParticles(w: number, h: number) {
  particles.length = 0
  for (let i = 0; i < 30; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 4 + 2,
      alpha: Math.random() * 0.5 + 0.2,
      alphaDir: (Math.random() - 0.5) * 0.01
    })
  }
}

function spawnMeteor(w: number, h: number) {
  // 从屏幕上方或右侧随机生成
  const fromTop = Math.random() > 0.3
  let x: number, y: number, angle: number
  if (fromTop) {
    x = Math.random() * w * 1.2
    y = -20
    angle = Math.PI / 4 + (Math.random() - 0.5) * 0.3 // 大约45度角
  } else {
    x = w + 20
    y = Math.random() * h * 0.5
    angle = Math.PI * 0.6 + (Math.random() - 0.5) * 0.3 // 从右侧
  }
  meteors.push({
    x, y,
    length: 80 + Math.random() * 120,
    speed: 4 + Math.random() * 6,
    angle,
    alpha: 0.6 + Math.random() * 0.4,
    width: 1 + Math.random() * 2,
    life: 0,
    maxLife: 60 + Math.random() * 80
  })
}

function drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor) {
  const progress = m.life / m.maxLife
  // 淡入淡出
  let alpha = m.alpha
  if (progress < 0.1) alpha *= progress / 0.1
  else if (progress > 0.7) alpha *= (1 - progress) / 0.3

  const tailX = m.x - Math.cos(m.angle) * m.length
  const tailY = m.y - Math.sin(m.angle) * m.length

  const gradient = ctx.createLinearGradient(tailX, tailY, m.x, m.y)
  gradient.addColorStop(0, `rgba(255, 107, 157, 0)`)
  gradient.addColorStop(0.6, `rgba(255, 150, 200, ${alpha * 0.5})`)
  gradient.addColorStop(1, `rgba(255, 220, 240, ${alpha})`)

  ctx.beginPath()
  ctx.moveTo(tailX, tailY)
  ctx.lineTo(m.x, m.y)
  ctx.strokeStyle = gradient
  ctx.lineWidth = m.width
  ctx.lineCap = 'round'
  ctx.stroke()

  // 流星头部发光点
  ctx.beginPath()
  ctx.arc(m.x, m.y, m.width * 1.5, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 230, 245, ${alpha * 0.8})`
  ctx.fill()
}

function animate() {
  const cvs = canvas.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')
  if (!ctx) return

  const w = cvs.width
  const h = cvs.height

  ctx.clearRect(0, 0, w, h)

  // 绘制背景粒子
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    p.alpha += p.alphaDir

    if (p.alpha > 0.7 || p.alpha < 0.1) p.alphaDir *= -1
    if (p.x < 0) p.x = w
    if (p.x > w) p.x = 0
    if (p.y < 0) p.y = h
    if (p.y > h) p.y = 0

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 107, 157, ${p.alpha})`
    ctx.fill()
  }

  // 随机生成流星
  if (Math.random() < 0.015) {
    spawnMeteor(w, h)
  }

  // 更新和绘制流星
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i]
    m.x += Math.cos(m.angle) * m.speed
    m.y += Math.sin(m.angle) * m.speed
    m.life++

    drawMeteor(ctx, m)

    if (m.life >= m.maxLife || m.x > w + 200 || m.y > h + 200) {
      meteors.splice(i, 1)
    }
  }

  animId = requestAnimationFrame(animate)
}

function resize() {
  const cvs = canvas.value
  if (!cvs) return
  cvs.width = window.innerWidth
  cvs.height = window.innerHeight
  if (particles.length === 0) initParticles(cvs.width, cvs.height)
}

onMounted(() => {
  resize()
  animate()
  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas ref="canvas" class="particle-bg" />
</template>

import type { Note, Judgment } from '../types'

// 颜色常量
const COLORS = {
  bg1: '#1a0a2e',
  bg2: '#241245',
  leftTrack: '#ff6b9d',
  rightTrack: '#c44dff',
  perfect: '#ffd700',
  great: '#ff6b9d',
  good: '#c44dff',
  miss: '#ff4444',
  special: '#ffd700'
}

// 判定粒子
interface JudgmentParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  radius: number
}

// 判定文字
interface JudgmentText {
  text: string
  color: string
  x: number
  y: number
  life: number
  maxLife: number
}

// 背景粒子
interface BgParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  alphaDir: number
}

// 背景流星
interface BgMeteor {
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

// 应援棒状态
interface PenlightState {
  leftAngle: number
  rightAngle: number
  leftTargetAngle: number
  rightTargetAngle: number
  leftGlow: number
  rightGlow: number
}

export class GameRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private bgParticles: BgParticle[] = []
  private bgMeteors: BgMeteor[] = []
  private judgmentParticles: JudgmentParticle[] = []
  private judgmentTexts: JudgmentText[] = []
  private penlight: PenlightState = {
    leftAngle: 0, rightAngle: 0,
    leftTargetAngle: 0, rightTargetAngle: 0,
    leftGlow: 0, rightGlow: 0
  }
  private time = 0

  // Screen shake
  private shakeIntensity = 0
  private shakeDuration = 0
  private shakeTimer = 0

  // Image paths
  static tapImagePath = '/taffyball.png'
  static specialImagePath = '/blackball.png'

  // Image assets
  private noteImage: HTMLImageElement | null = null
  private noteImageLoaded = false
  private specialImage: HTMLImageElement | null = null
  private specialImageLoaded = false

  // 轨道参数
  private trackY = 0 // 轨道 Y 位置（60% 高度）
  private leftJudgeX = 0 // 左判定圈 X（35% 宽度）
  private rightJudgeX = 0 // 右判定圈 X（65% 宽度）
  private judgeRadius = 0 // 判定圈半径

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文')
    this.ctx = ctx
    this.resize()
    this.initBgParticles()
    this.loadNoteImage()
  }

  loadNoteImage() {
    this.noteImage = new Image()
    this.noteImage.onload = () => { this.noteImageLoaded = true }
    this.noteImage.src = GameRenderer.tapImagePath

    this.specialImage = new Image()
    this.specialImage.onload = () => { this.specialImageLoaded = true }
    this.specialImage.src = GameRenderer.specialImagePath
  }

  reloadImages() {
    this.loadNoteImage()
  }

  triggerShake(intensity: number, duration: number) {
    this.shakeIntensity = intensity
    this.shakeDuration = duration
    this.shakeTimer = duration
  }

  resize() {
    const dpr = window.devicePixelRatio || 1
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width * dpr
    this.canvas.height = this.height * dpr
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // 更新轨道参数
    this.trackY = this.height * 0.5
    this.leftJudgeX = this.width * 0.4
    this.rightJudgeX = this.width * 0.6
    this.judgeRadius = Math.min(this.width, this.height) * 0.055

    this.initBgParticles()
  }

  private initBgParticles() {
    this.bgParticles = []
    for (let i = 0; i < 30; i++) {
      this.bgParticles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 4 + 2,
        alpha: Math.random() * 0.5 + 0.2,
        alphaDir: (Math.random() - 0.5) * 0.01
      })
    }
  }

  // 触发应援棒挥动
  triggerPenlight(track: number) {
    if (track === 0) {
      this.penlight.leftTargetAngle = -60
      this.penlight.leftGlow = 1
    } else if (track === 1) {
      this.penlight.rightTargetAngle = 60
      this.penlight.rightGlow = 1
    } else {
      // 双手
      this.penlight.leftTargetAngle = -60
      this.penlight.rightTargetAngle = 60
      this.penlight.leftGlow = 1
      this.penlight.rightGlow = 1
    }
  }

  // 添加判定粒子爆发
  addJudgmentEffect(x: number, y: number, judgment: Judgment) {
    const color = judgment === 'perfect' ? COLORS.perfect
      : judgment === 'great' ? COLORS.great
      : judgment === 'good' ? COLORS.good
      : COLORS.miss

    // 粒子爆发
    const count = judgment === 'perfect' ? 20 : judgment === 'miss' ? 0 : 12
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3
      const speed = 2 + Math.random() * 4
      this.judgmentParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        color,
        radius: 2 + Math.random() * 3
      })
    }

    // 判定文字
    const text = judgment.toUpperCase()
    this.judgmentTexts.push({
      text,
      color,
      x,
      y: y - 40,
      life: 1,
      maxLife: 1
    })
  }

  // 计算音符在轨道上的位置
  getNotePosition(note: Note, songTime: number, scrollSpeed: number): { x: number, y: number } | null {
    const timeDiff = note.time - songTime
    if (timeDiff < -1 || timeDiff > 3) return null // 不在可见范围内

    const travelTime = 2 / scrollSpeed * 5 // 音符从边缘到判定圈的时间（秒）
    const progress = 1 - (timeDiff / travelTime) // 0 = 在边缘, 1 = 在判定圈

    if (progress < 0 || progress > 1.2) return null

    const track = note.track
    const edgeX = track === 0 ? 0 : this.width
    const judgeX = track === 0 ? this.leftJudgeX : this.rightJudgeX

    const x = edgeX + (judgeX - edgeX) * Math.min(progress, 1)
    const y = this.trackY

    return { x, y }
  }

  // 主渲染函数
  render(songTime: number, notes: Note[], combo: number, score: number, countdown: number, isPaused: boolean) {
    this.time = songTime
    const ctx = this.ctx
    const w = this.width
    const h = this.height

    // Calculate shake offset
    let shakeX = 0
    let shakeY = 0
    if (this.shakeTimer > 0) {
      this.shakeTimer -= 1 / 60
      const progress = this.shakeTimer / this.shakeDuration
      const currentIntensity = this.shakeIntensity * progress
      shakeX = (Math.random() - 0.5) * 2 * currentIntensity
      shakeY = (Math.random() - 0.5) * 2 * currentIntensity
    }

    ctx.save()
    ctx.translate(shakeX, shakeY)

    // 清空画布
    ctx.clearRect(0, 0, w, h)

    // 1. 背景渐变
    const bgGrad = ctx.createLinearGradient(0, 0, w, h)
    bgGrad.addColorStop(0, COLORS.bg1)
    bgGrad.addColorStop(0.5, COLORS.bg2)
    bgGrad.addColorStop(1, COLORS.bg1)
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, w, h)

    // 2. 背景粒子
    this.renderBgParticles()

    // 2.5 背景流星
    this.renderBgMeteors()

    // 3. 应援棒（背景层）
    this.renderPenlights()

    // 4. 轨道线
    this.renderTracks()

    // 5. 音符
    this.renderNotes(songTime, notes)

    // 6. 判定圈
    this.renderJudgeCircles()

    // 7. 判定效果
    this.renderJudgmentEffects()

    // 8. HUD
    this.renderHUD(combo, score)

    // 9. 倒计时
    if (countdown > 0) {
      this.renderCountdown(countdown)
    }

    // 10. 暂停界面（由 HTML overlay 处理，不在 canvas 上绘制）
    // if (isPaused) { this.renderPauseOverlay() }

    ctx.restore() // 恢复抖动偏移
  }

  private renderBgParticles() {
    const ctx = this.ctx
    for (const p of this.bgParticles) {
      p.x += p.vx
      p.y += p.vy
      p.alpha += p.alphaDir
      if (p.alpha > 0.7 || p.alpha < 0.1) p.alphaDir *= -1
      if (p.x < 0) p.x = this.width
      if (p.x > this.width) p.x = 0
      if (p.y < 0) p.y = this.height
      if (p.y > this.height) p.y = 0

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 107, 157, ${p.alpha})`
      ctx.fill()
    }
  }

  private renderBgMeteors() {
    const ctx = this.ctx
    const w = this.width
    const h = this.height

    // 随机生成流星
    if (Math.random() < 0.012) {
      const fromTop = Math.random() > 0.3
      let x: number, y: number, angle: number
      if (fromTop) {
        x = Math.random() * w * 1.2
        y = -20
        angle = Math.PI / 4 + (Math.random() - 0.5) * 0.3
      } else {
        x = w + 20
        y = Math.random() * h * 0.5
        angle = Math.PI * 0.6 + (Math.random() - 0.5) * 0.3
      }
      this.bgMeteors.push({
        x, y,
        length: 60 + Math.random() * 100,
        speed: 3 + Math.random() * 5,
        angle,
        alpha: 0.4 + Math.random() * 0.3,
        width: 1 + Math.random() * 1.5,
        life: 0,
        maxLife: 60 + Math.random() * 80
      })
    }

    // 更新和绘制流星
    for (let i = this.bgMeteors.length - 1; i >= 0; i--) {
      const m = this.bgMeteors[i]
      m.x += Math.cos(m.angle) * m.speed
      m.y += Math.sin(m.angle) * m.speed
      m.life++

      const progress = m.life / m.maxLife
      let alpha = m.alpha
      if (progress < 0.1) alpha *= progress / 0.1
      else if (progress > 0.7) alpha *= (1 - progress) / 0.3

      const tailX = m.x - Math.cos(m.angle) * m.length
      const tailY = m.y - Math.sin(m.angle) * m.length

      const gradient = ctx.createLinearGradient(tailX, tailY, m.x, m.y)
      gradient.addColorStop(0, `rgba(255, 107, 157, 0)`)
      gradient.addColorStop(0.6, `rgba(255, 150, 200, ${alpha * 0.4})`)
      gradient.addColorStop(1, `rgba(255, 220, 240, ${alpha})`)

      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(m.x, m.y)
      ctx.strokeStyle = gradient
      ctx.lineWidth = m.width
      ctx.lineCap = 'round'
      ctx.stroke()

      // 头部发光
      ctx.beginPath()
      ctx.arc(m.x, m.y, m.width * 1.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 230, 245, ${alpha * 0.6})`
      ctx.fill()

      if (m.life >= m.maxLife || m.x > w + 200 || m.y > h + 200) {
        this.bgMeteors.splice(i, 1)
      }
    }
  }

  private renderTracks() {
    const ctx = this.ctx
    const y = this.trackY

    // 左轨道线（粉色发光）
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(this.leftJudgeX, y)
    const leftGrad = ctx.createLinearGradient(0, y, this.leftJudgeX, y)
    leftGrad.addColorStop(0, 'rgba(255, 107, 157, 0)')
    leftGrad.addColorStop(1, 'rgba(255, 107, 157, 0.6)')
    ctx.strokeStyle = leftGrad
    ctx.lineWidth = 3
    ctx.stroke()

    // 左轨道发光
    ctx.shadowColor = COLORS.leftTrack
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.moveTo(this.leftJudgeX * 0.5, y)
    ctx.lineTo(this.leftJudgeX, y)
    ctx.strokeStyle = 'rgba(255, 107, 157, 0.3)'
    ctx.lineWidth = 6
    ctx.stroke()
    ctx.shadowBlur = 0

    // 右轨道线（紫色发光）
    ctx.beginPath()
    ctx.moveTo(this.width, y)
    ctx.lineTo(this.rightJudgeX, y)
    const rightGrad = ctx.createLinearGradient(this.width, y, this.rightJudgeX, y)
    rightGrad.addColorStop(0, 'rgba(196, 77, 255, 0)')
    rightGrad.addColorStop(1, 'rgba(196, 77, 255, 0.6)')
    ctx.strokeStyle = rightGrad
    ctx.lineWidth = 3
    ctx.stroke()

    // 右轨道发光
    ctx.shadowColor = COLORS.rightTrack
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.moveTo(this.rightJudgeX + (this.width - this.rightJudgeX) * 0.5, y)
    ctx.lineTo(this.rightJudgeX, y)
    ctx.strokeStyle = 'rgba(196, 77, 255, 0.3)'
    ctx.lineWidth = 6
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  private renderJudgeCircles() {
    const ctx = this.ctx
    const y = this.trackY
    const r = this.judgeRadius
    const pulse = Math.sin(this.time * 4) * 0.15 + 1 // 脉冲效果

    // 左判定圈
    ctx.beginPath()
    ctx.arc(this.leftJudgeX, y, r * pulse, 0, Math.PI * 2)
    ctx.strokeStyle = COLORS.leftTrack
    ctx.lineWidth = 3
    ctx.shadowColor = COLORS.leftTrack
    ctx.shadowBlur = 6
    ctx.stroke()
    ctx.shadowBlur = 0

    // 左判定圈填充
    ctx.beginPath()
    ctx.arc(this.leftJudgeX, y, r * pulse, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 107, 157, 0.1)'
    ctx.fill()

    // 右判定圈
    ctx.beginPath()
    ctx.arc(this.rightJudgeX, y, r * pulse, 0, Math.PI * 2)
    ctx.strokeStyle = COLORS.rightTrack
    ctx.lineWidth = 3
    ctx.shadowColor = COLORS.rightTrack
    ctx.shadowBlur = 6
    ctx.stroke()
    ctx.shadowBlur = 0

    // 右判定圈填充
    ctx.beginPath()
    ctx.arc(this.rightJudgeX, y, r * pulse, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(196, 77, 255, 0.1)'
    ctx.fill()
  }

  private renderNotes(songTime: number, notes: Note[]) {
    const ctx = this.ctx
    const scrollSpeed = 5 // 默认滚动速度

    for (const note of notes) {
      // Hold 音符按住期间继续显示，只有 missed 或（hit 且非 hold）才跳过
      if (note.missed) continue
      if (note.hit && note.type !== 'hold') continue

      // things notes are invisible, trigger shake when approaching
      if (note.type === 'things') {
        if (songTime >= note.time - 0.05) {
          note.hit = true
          this.triggerShake(8, 0.3)
        }
        continue
      }

      const pos = this.getNotePosition(note, songTime, scrollSpeed)
      if (!pos) continue

      const noteSize = this.judgeRadius * 0.8

      switch (note.type) {
        case 'tap':
          this.drawTapNote(ctx, pos.x, pos.y, noteSize, note.track)
          break
        case 'hold':
          this.drawHoldNote(ctx, note, pos, songTime, noteSize, scrollSpeed)
          break
        case 'special':
          this.drawSpecialNote(ctx, pos.x, pos.y, noteSize)
          break
      }
    }
  }

  private drawTapNote(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, track: number) {
    const color = track === 0 ? COLORS.leftTrack : COLORS.rightTrack
    const halfW = size * 0.8
    const halfH = size * 0.8

    if (this.noteImageLoaded && this.noteImage) {
      // Draw with subtle glow
      ctx.save()
      ctx.shadowColor = color
      ctx.shadowBlur = 6
      ctx.drawImage(this.noteImage, x - halfW, y - halfH, halfW * 2, halfH * 2)
      ctx.restore()
    } else {
      // Fallback geometric shape
      const r = 6
      ctx.beginPath()
      ctx.roundRect(x - halfW, y - halfH, halfW * 2, halfH * 2, r)
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 6
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  private drawHoldNote(ctx: CanvasRenderingContext2D, note: Note, pos: { x: number, y: number }, songTime: number, size: number, scrollSpeed: number) {
    const color = note.track === 0 ? COLORS.leftTrack : COLORS.rightTrack
    const colorRgb = note.track === 0 ? '255, 107, 157' : '196, 77, 255'
    const halfW = size * 0.8
    const halfH = size * 0.8

    // 先画 Hold 尾巴（在音符头部下方）
    if (note.duration) {
      const tailEnd = this.getNotePosition(
        { ...note, time: note.time + note.duration },
        songTime, scrollSpeed
      )
      if (tailEnd) {
        // 尾巴主体
        const tailHalfH = halfH * 0.5
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y - tailHalfH)
        ctx.lineTo(tailEnd.x, tailEnd.y - tailHalfH)
        ctx.lineTo(tailEnd.x, tailEnd.y + tailHalfH)
        ctx.lineTo(pos.x, pos.y + tailHalfH)
        ctx.closePath()
        ctx.fillStyle = `rgba(${colorRgb}, 0.3)`
        ctx.fill()

        // 尾巴结尾标记（小菱形）
        const endSize = halfH * 0.6
        ctx.beginPath()
        ctx.moveTo(tailEnd.x, tailEnd.y - endSize)
        ctx.lineTo(tailEnd.x + endSize, tailEnd.y)
        ctx.lineTo(tailEnd.x, tailEnd.y + endSize)
        ctx.lineTo(tailEnd.x - endSize, tailEnd.y)
        ctx.closePath()
        ctx.fillStyle = color
        ctx.globalAlpha = 0.7
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    // 再画 Hold 音符主体（头部，覆盖在尾巴上方）
    if (this.noteImageLoaded && this.noteImage) {
      ctx.save()
      ctx.shadowColor = color
      ctx.shadowBlur = 6
      ctx.drawImage(this.noteImage, pos.x - halfW, pos.y - halfH, halfW * 2, halfH * 2)
      ctx.restore()
    } else {
      ctx.beginPath()
      ctx.roundRect(pos.x - halfW, pos.y - halfH, halfW * 2, halfH * 2, 6)
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 6
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  private drawSpecialNote(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    const color = COLORS.special
    if (this.specialImageLoaded && this.specialImage) {
      ctx.save()
      ctx.shadowColor = color
      ctx.shadowBlur = 6
      ctx.drawImage(this.specialImage, x - size * 0.8, y - size * 0.8, size * 1.6, size * 1.6)
      ctx.restore()
    } else {
      // Fallback gold diamond shape
      ctx.beginPath()
      ctx.moveTo(x, y - size)
      ctx.lineTo(x + size, y)
      ctx.lineTo(x, y + size)
      ctx.lineTo(x - size, y)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 6
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number, color: string) {
    ctx.beginPath()
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR
      const angle = (Math.PI * i) / spikes - Math.PI / 2
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 6
    ctx.fill()
    ctx.shadowBlur = 0
  }

  private renderJudgmentEffects() {
    const ctx = this.ctx

    // 更新和绘制粒子
    for (let i = this.judgmentParticles.length - 1; i >= 0; i--) {
      const p = this.judgmentParticles[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.1 // 重力
      p.life -= 0.02

      if (p.life <= 0) {
        this.judgmentParticles.splice(i, 1)
        continue
      }

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2)
      ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, '0')
      ctx.fill()
    }

    // 更新和绘制判定文字
    for (let i = this.judgmentTexts.length - 1; i >= 0; i--) {
      const t = this.judgmentTexts[i]
      t.y -= 1.5 // 上浮
      t.life -= 0.02

      if (t.life <= 0) {
        this.judgmentTexts.splice(i, 1)
        continue
      }

      ctx.save()
      ctx.globalAlpha = t.life
      ctx.font = `bold ${24 + (1 - t.life) * 8}px "Microsoft YaHei", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillStyle = t.color
      ctx.shadowColor = t.color
      ctx.shadowBlur = 6
      ctx.fillText(t.text, t.x, t.y)
      ctx.restore()
    }
  }

  private renderPenlights() {
    const ctx = this.ctx
    const h = this.height

    // 更新应援棒动画
    this.penlight.leftAngle += (this.penlight.leftTargetAngle - this.penlight.leftAngle) * 0.15
    this.penlight.rightAngle += (this.penlight.rightTargetAngle - this.penlight.rightAngle) * 0.15
    this.penlight.leftGlow *= 0.95
    this.penlight.rightGlow *= 0.95

    // 回弹
    if (Math.abs(this.penlight.leftAngle - this.penlight.leftTargetAngle) < 1) {
      this.penlight.leftTargetAngle *= 0.8
    }
    if (Math.abs(this.penlight.rightAngle - this.penlight.rightTargetAngle) < 1) {
      this.penlight.rightTargetAngle *= 0.8
    }

    // 绘制左手应援棒
    this.drawPenlight(ctx, this.width * 0.3, h * 0.85, this.penlight.leftAngle, COLORS.leftTrack, this.penlight.leftGlow)
    // 绘制右手应援棒
    this.drawPenlight(ctx, this.width * 0.7, h * 0.85, this.penlight.rightAngle, COLORS.rightTrack, this.penlight.rightGlow)
  }

  private drawPenlight(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, glow: number) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((angle * Math.PI) / 180)
    ctx.globalAlpha = 0.4 + glow * 0.4

    const stickLen = this.height * 0.25
    const stickWidth = 8
    const ballRadius = 14 + glow * 10

    // 棒身
    const grad = ctx.createLinearGradient(0, 0, 0, -stickLen)
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
    grad.addColorStop(1, color)
    ctx.beginPath()
    ctx.roundRect(-stickWidth / 2, -stickLen, stickWidth, stickLen, 2)
    ctx.fillStyle = grad
    ctx.fill()

    // 顶端发光球
    ctx.beginPath()
    ctx.arc(0, -stickLen, ballRadius, 0, Math.PI * 2)
    const ballGrad = ctx.createRadialGradient(0, -stickLen, 0, 0, -stickLen, ballRadius)
    ballGrad.addColorStop(0, '#ffffff')
    ballGrad.addColorStop(0.3, color)
    ballGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = ballGrad
    ctx.fill()

    // 光晕
    if (glow > 0.1) {
      ctx.beginPath()
      ctx.arc(0, -stickLen, ballRadius * 3, 0, Math.PI * 2)
      const haloGrad = ctx.createRadialGradient(0, -stickLen, 0, 0, -stickLen, ballRadius * 3)
      haloGrad.addColorStop(0, color + Math.floor(glow * 100).toString(16).padStart(2, '0'))
      haloGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = haloGrad
      ctx.fill()
    }

    ctx.restore()
  }

  private renderHUD(combo: number, score: number) {
    const ctx = this.ctx

    // COMBO 显示（两个判定圈上方中间）
    if (combo > 0) {
      const comboX = (this.leftJudgeX + this.rightJudgeX) / 2
      const comboY = this.trackY - this.judgeRadius * 3

      ctx.save()
      ctx.textAlign = 'center'
      ctx.font = `bold ${Math.min(48, 24 + combo * 0.5)}px "Microsoft YaHei", sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = COLORS.perfect
      ctx.shadowBlur = combo > 10 ? 20 : 10
      ctx.fillText(combo.toString(), comboX, comboY)

      ctx.font = '14px "Microsoft YaHei", sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.shadowBlur = 0
      ctx.fillText('COMBO', comboX, comboY + 20)
      ctx.restore()
    }

    // 分数显示（右上角）
    ctx.save()
    ctx.textAlign = 'right'
    ctx.font = 'bold 28px "Microsoft YaHei", sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(score.toLocaleString(), this.width - 30, 50)
    ctx.font = '12px "Microsoft YaHei", sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('SCORE', this.width - 30, 68)
    ctx.restore()
  }

  private renderCountdown(value: number) {
    const ctx = this.ctx
    const cx = this.width / 2
    const cy = this.height / 2

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold 120px "Microsoft YaHei", sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = COLORS.perfect
    ctx.shadowBlur = 6
    ctx.globalAlpha = 0.8
    ctx.fillText(value.toString(), cx, cy)
    ctx.restore()
  }

  private renderPauseOverlay() {
    const ctx = this.ctx
    const w = this.width
    const h = this.height

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, w, h)

    // 暂停文字
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 48px "Microsoft YaHei", sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText('暂停', w / 2, h / 2 - 40)

    ctx.font = '18px "Microsoft YaHei", sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.fillText('按 ESC 继续', w / 2, h / 2 + 20)
    ctx.restore()
  }

  // 获取判定圈位置（供外部使用）
  getJudgePositions() {
    return {
      left: { x: this.leftJudgeX, y: this.trackY },
      right: { x: this.rightJudgeX, y: this.trackY }
    }
  }
}

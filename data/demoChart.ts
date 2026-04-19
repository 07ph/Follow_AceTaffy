import type { Chart, Note } from '../types'

function generateNoteId(): string {
  return 'note_' + Math.random().toString(36).substr(2, 9)
}

// 生成示例谱面 - BPM 120, Normal Lv.5
function generateDemoChart(): Note[] {
  const bpm = 120
  const beatInterval = 60 / bpm // 0.5秒一拍
  const startOffset = 4 // 4秒后开始（倒计时后）

  // 简单的节奏模式
  const patterns: { time: number; track: number; type: Note['type']; duration?: number }[] = []

  // 第一段：简单的交替 (8拍)
  for (let i = 0; i < 8; i++) {
    patterns.push({
      time: startOffset + i * beatInterval,
      track: i % 2 === 0 ? 0 : 1,
      type: 'tap'
    })
  }

  // 第二段：双押 (4拍)
  for (let i = 0; i < 4; i++) {
    const t = startOffset + 8 * beatInterval + i * beatInterval
    patterns.push({ time: t, track: 0, type: 'tap' })
    patterns.push({ time: t, track: 1, type: 'tap' })
  }

  // 第三段：快速交替 (8个八分音符)
  for (let i = 0; i < 8; i++) {
    patterns.push({
      time: startOffset + 12 * beatInterval + i * beatInterval * 0.5,
      track: i % 2 === 0 ? 0 : 1,
      type: 'tap'
    })
  }

  // 第四段：加入 hold
  for (let i = 0; i < 4; i++) {
    const t = startOffset + 16 * beatInterval + i * beatInterval
    patterns.push({ time: t, track: 0, type: 'hold', duration: beatInterval * 2 })
    patterns.push({ time: t + beatInterval * 0.5, track: 1, type: 'tap' })
  }

  // 第五段：special 音符
  patterns.push({
    time: startOffset + 20 * beatInterval,
    track: 0,
    type: 'special'
  })
  patterns.push({
    time: startOffset + 20 * beatInterval,
    track: 1,
    type: 'special'
  })

  // 第六段：高潮 - 密集音符
  for (let i = 0; i < 16; i++) {
    const t = startOffset + 22 * beatInterval + i * beatInterval * 0.5
    patterns.push({
      time: t,
      track: i % 2 === 0 ? 0 : 1,
      type: 'tap'
    })
  }

  // 第七段：结尾
  for (let i = 0; i < 4; i++) {
    const t = startOffset + 30 * beatInterval + i * beatInterval
    patterns.push({ time: t, track: 0, type: 'tap' })
    patterns.push({ time: t, track: 1, type: 'tap' })
  }

  // 最后一个 special
  patterns.push({
    time: startOffset + 34 * beatInterval,
    track: 0,
    type: 'special'
  })

  return patterns.map(p => ({
    id: generateNoteId(),
    time: Math.round(p.time * 1000) / 1000,
    type: p.type,
    track: p.track,
    duration: p.duration ? Math.round(p.duration * 1000) / 1000 : undefined,
    hit: false,
    missed: false
  }))
}

export const demoChart: Chart = {
  title: '关注塔菲谢谢喵',
  artist: '永雏塔菲',
  difficulty: 'Normal',
  level: 5,
  bpm: 120,
  offset: 0,
  notes: generateDemoChart()
}

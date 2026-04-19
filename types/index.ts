export type NoteType = 'tap' | 'hold' | 'special' | 'things'
export type Judgment = 'perfect' | 'great' | 'good' | 'miss'
export type GamePhase = 'idle' | 'loading' | 'countdown' | 'playing' | 'paused' | 'ended'

export interface Note {
  id: string
  time: number       // 击打时间（秒）
  type: NoteType
  track: number      // 0=左, 1=右
  duration?: number  // hold 音符持续时间
  hit?: boolean
  missed?: boolean
  holdStartTime?: number
}

export interface Chart {
  title: string
  artist: string
  difficulty: string
  level: number
  bpm: number
  offset: number
  notes: Note[]
  bgm?: string
}

export interface JudgmentResult {
  judgment: Judgment
  time: number
  track: number
  noteId: string
}

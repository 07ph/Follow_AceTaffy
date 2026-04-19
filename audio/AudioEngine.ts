import { Howl } from 'howler'

export class AudioEngine {
  private howl: Howl | null = null
  private _isPlaying = false
  private _startTime = 0
  private _pauseTime = 0
  private _lastValidTime = 0
  private _loadTimeout: ReturnType<typeof setTimeout> | null = null
  private _loaded = false
  private _duration = 0

  async loadBGM(src: string, timeoutMs = 5000): Promise<boolean> {
    this.destroy()

    return new Promise((resolve) => {
      let settled = false
      const done = (result: boolean) => {
        if (settled) return
        settled = true
        if (this._loadTimeout) {
          clearTimeout(this._loadTimeout)
          this._loadTimeout = null
        }
        resolve(result)
      }

      // 超时保护
      this._loadTimeout = setTimeout(() => {
        console.warn('[AudioEngine] 音频加载超时，进入无音频模式')
        done(false)
      }, timeoutMs)

      try {
        this.howl = new Howl({
          src: [src],
          html5: true,
          format: ['mp3', 'wav', 'ogg'],
          preload: true,
          onload: () => {
            this._loaded = true
            this._duration = this.howl!.duration()
            console.log('[AudioEngine] 音频加载成功，时长:', this._duration)
            done(true)
          },
          onloaderror: (_id, err) => {
            console.warn('[AudioEngine] 音频加载失败:', err)
            done(false)
          },
          onplayerror: (_id, err) => {
            console.warn('[AudioEngine] 播放错误:', err)
            this._isPlaying = false
          },
          onplay: () => {
            this._isPlaying = true
            this._startTime = performance.now()
          },
          onpause: () => {
            this._isPlaying = false
          },
          onstop: () => {
            this._isPlaying = false
            this._pauseTime = 0
            this._startTime = 0
          },
          onend: () => {
            this._isPlaying = false
            this._pauseTime = 0
          }
        })
      } catch (e) {
        console.warn('[AudioEngine] 创建 Howl 失败:', e)
        done(false)
      }
    })
  }

  playBGM(): void {
    if (!this.howl || !this._loaded) return
    if (this._pauseTime > 0) {
      this.howl.seek(this._pauseTime)
    }
    this.howl.play()
    this._startTime = performance.now()
    this._isPlaying = true
  }

  pauseBGM(): void {
    if (!this.howl || !this._loaded) return
    this._pauseTime = this.getBGMTime()
    this.howl.pause()
    this._isPlaying = false
  }

  stopBGM(): void {
    if (!this.howl || !this._loaded) return
    this.howl.stop()
    this._isPlaying = false
    this._pauseTime = 0
    this._startTime = 0
    this._lastValidTime = 0
  }

  getBGMTime(): number {
    if (!this.howl || !this._loaded) return 0

    // 优先使用 Howl 的 seek
    try {
      const t = this.howl.seek() as number
      if (typeof t === 'number' && !isNaN(t) && isFinite(t)) {
        // 防跳变：忽略 > 0.5s 的突然跳变
        if (this._lastValidTime > 0 && Math.abs(t - this._lastValidTime) > 0.5) {
          // 可能是 seek 操作，重置基准
          this._lastValidTime = t
          return t
        }
        this._lastValidTime = t
        return t
      }
    } catch {
      // fallback
    }

    // Fallback: 使用 performance.now()
    if (this._isPlaying && this._startTime > 0) {
      const elapsed = (performance.now() - this._startTime) / 1000
      const t = this._pauseTime + elapsed
      if (!isNaN(t) && isFinite(t) && t >= 0) {
        this._lastValidTime = t
        return t
      }
    }

    return this._lastValidTime
  }

  seek(time: number): void {
    if (!this.howl || !this._loaded) return
    this.howl.seek(time)
    this._lastValidTime = time
    if (this._isPlaying) {
      this._startTime = performance.now()
      this._pauseTime = time
    } else {
      this._pauseTime = time
    }
  }

  setVolume(vol: number): void {
    if (!this.howl) return
    this.howl.volume(Math.max(0, Math.min(1, vol)))
  }

  getDuration(): number {
    if (!this.howl || !this._loaded) return 0
    return this._duration
  }

  isPlaying(): boolean {
    return this._isPlaying
  }

  isLoaded(): boolean {
    return this._loaded
  }

  destroy(): void {
    if (this._loadTimeout) {
      clearTimeout(this._loadTimeout)
      this._loadTimeout = null
    }
    if (this.howl) {
      this.howl.unload()
      this.howl = null
    }
    this._isPlaying = false
    this._loaded = false
    this._startTime = 0
    this._pauseTime = 0
    this._lastValidTime = 0
    this._duration = 0
  }
}

// 全局单例
export const audioEngine = new AudioEngine()

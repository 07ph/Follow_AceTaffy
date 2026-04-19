<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings'
import ParticleBackground from '../components/ParticleBackground.vue'

const router = useRouter()
const settings = useSettingsStore()
</script>

<template>
  <div class="page-container">
    <ParticleBackground />
    <div class="settings-content">
      <h1 class="page-title fade-in">设置</h1>

      <div class="settings-panel fade-in fade-in-delay-1">
        <div class="setting-item">
          <label class="setting-label">🎵 BGM 音量</label>
          <div class="setting-control">
            <input
              type="range"
              min="0"
              max="100"
              :value="settings.bgmVolume * 100"
              @input="settings.setBgmVolume(($event.target as HTMLInputElement).valueAsNumber / 100)"
              class="slider"
            />
            <span class="setting-value">{{ Math.round(settings.bgmVolume * 100) }}%</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">🔊 音效音量</label>
          <div class="setting-control">
            <input
              type="range"
              min="0"
              max="100"
              :value="settings.sfxVolume * 100"
              @input="settings.setSfxVolume(($event.target as HTMLInputElement).valueAsNumber / 100)"
              class="slider"
            />
            <span class="setting-value">{{ Math.round(settings.sfxVolume * 100) }}%</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">⚡ 滚动速度</label>
          <div class="setting-control">
            <input
              type="range"
              min="1"
              max="15"
              :value="settings.scrollSpeed"
              @input="settings.setScrollSpeed(($event.target as HTMLInputElement).valueAsNumber)"
              class="slider"
            />
            <span class="setting-value">{{ settings.scrollSpeed }}</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">⏱️ 全局偏移量 (ms)</label>
          <div class="setting-control">
            <input
              type="range"
              min="-200"
              max="200"
              :value="settings.offset * 1000"
              @input="settings.setOffset(($event.target as HTMLInputElement).valueAsNumber / 1000)"
              class="slider"
            />
            <span class="setting-value">{{ Math.round(settings.offset * 1000) }}ms</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">🎮 输入偏移量 (ms)</label>
          <div class="setting-control">
            <input
              type="range"
              min="-200"
              max="200"
              :value="settings.inputOffset * 1000"
              @input="settings.setInputOffset(($event.target as HTMLInputElement).valueAsNumber / 1000)"
              class="slider"
            />
            <span class="setting-value">{{ Math.round(settings.inputOffset * 1000) }}ms</span>
          </div>
        </div>
      </div>

      <button class="btn fade-in fade-in-delay-2" @click="router.push('/')">🏠 返回主页</button>

      <div class="credits-panel fade-in fade-in-delay-3">
        <p class="credits-title">💖 关于</p>
        <div class="credits-links">
          <a href="http://live.bilibili.com/22603245" target="_blank" rel="noopener">📺 永雏塔菲的直播间</a>
          <a href="https://space.bilibili.com/1265680561" target="_blank" rel="noopener">🏠 永雏塔菲的B站空间</a>
          <a href="https://www.bilibili.com/video/BV1EF3uzeETo" target="_blank" rel="noopener">🎬 《关注塔菲谢谢喵》</a>
        </div>
        <p class="credits-slogan">关注永雏塔菲喵，关注永雏塔菲谢谢喵 ✨</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px;
  max-width: 500px;
  width: 100%;
}

.page-title {
  font-size: 36px;
  font-weight: 700;
  background: linear-gradient(135deg, #ff6b9d, #c44dff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.settings-panel {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 157, 0.2);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  backdrop-filter: blur(10px);
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.credits-panel {
  width: 100%;
  background: rgba(255, 107, 157, 0.08);
  border: 1px solid rgba(255, 107, 157, 0.2);
  border-radius: 16px;
  padding: 20px 24px;
  text-align: center;
}

.credits-title {
  font-size: 16px;
  font-weight: 700;
  color: #ff6b9d;
  margin: 0 0 12px 0;
}

.credits-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.credits-links a {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: color 0.2s;
}

.credits-links a:hover {
  color: #ff6b9d;
}

.credits-slogan {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}
</style>

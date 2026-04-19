<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings'
import ParticleBackground from '../components/ParticleBackground.vue'

const router = useRouter()
const settings = useSettingsStore()
const showAbout = ref(false)
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

        <div class="setting-item">
          <label class="setting-label">🎵 主页背景音乐</label>
          <div class="setting-control">
            <button
              class="toggle-btn"
              :class="{ active: settings.homeBgm }"
              @click="settings.setHomeBgm(!settings.homeBgm)"
            >
              {{ settings.homeBgm ? '开启' : '关闭' }}
            </button>
            <span class="setting-value">{{ settings.homeBgm ? '✅' : '❌' }}</span>
          </div>
        </div>
      </div>

      <button class="btn fade-in fade-in-delay-2" @click="router.push('/')">🏠 返回主页</button>

      <button class="about-btn fade-in fade-in-delay-3" @click="showAbout = true">💖 关于</button>

      <!-- 关于弹窗 -->
      <Teleport to="body">
        <div v-if="showAbout" class="about-overlay" @click.self="showAbout = false">
          <div class="about-modal">
            <button class="about-close" @click="showAbout = false">✕</button>
            <p class="about-note">游戏按 Space 即可触发判定，本雏草姬很菜写的默认谱很差，所以只做了一半，谱面编辑器本雏草姬自认做的功能完善，有大手雏草姬可以自己捏谱 OvO</p>
            <div class="about-links">
              <a href="http://live.bilibili.com/22603245" target="_blank" rel="noopener">📺 永雏塔菲的直播间</a>
              <a href="https://space.bilibili.com/1265680561" target="_blank" rel="noopener">🏠 永雏塔菲的B站空间</a>
              <a href="https://www.bilibili.com/video/BV1EF3uzeETo" target="_blank" rel="noopener">🎬 《关注塔菲谢谢喵》</a>
            </div>
            <p class="about-slogan">关注永雏塔菲喵，关注永雏塔菲谢谢喵 ✨</p>
          </div>
        </div>
      </Teleport>
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

.toggle-btn {
  padding: 6px 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.toggle-btn.active {
  border-color: #ff6b9d;
  background: rgba(255, 107, 157, 0.2);
  color: #ff6b9d;
}

.about-btn {
  padding: 6px 16px;
  border: 1px solid rgba(255, 107, 157, 0.3);
  border-radius: 8px;
  background: rgba(255, 107, 157, 0.1);
  color: #ff6b9d;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}
.about-btn:hover {
  background: rgba(255, 107, 157, 0.2);
  border-color: #ff6b9d;
}

.about-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.about-modal {
  position: relative;
  background: rgba(30, 20, 40, 0.95);
  border: 1px solid rgba(255, 107, 157, 0.3);
  border-radius: 16px;
  padding: 28px;
  max-width: 420px;
  width: 90%;
  backdrop-filter: blur(10px);
}

.about-close {
  position: absolute;
  top: 12px; right: 12px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}
.about-close:hover {
  color: #ff6b9d;
  background: rgba(255, 107, 157, 0.1);
}

.about-note {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.8;
  margin: 0 0 16px 0;
}

.about-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.about-links a {
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  font-size: 14px;
  padding: 6px 10px;
  border-radius: 8px;
  transition: all 0.2s;
}
.about-links a:hover {
  color: #ff6b9d;
  background: rgba(255, 107, 157, 0.1);
}

.about-slogan {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  margin: 0;
}
</style>

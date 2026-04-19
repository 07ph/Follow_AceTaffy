<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import ParticleBackground from '../components/ParticleBackground.vue'

const router = useRouter()
const gameStore = useGameStore()

function retryGame() {
  // 重置游戏状态，强制重新初始化
  gameStore.resetGame()
  router.replace('/game?retry=' + Date.now())
}

const grade = computed(() => gameStore.grade)
const gradeColor = computed(() => {
  const colors: Record<string, string> = {
    S: '#ffd700',
    A: '#ff6b9d',
    B: '#c44dff',
    C: '#4dc9f6',
    D: '#ff4444'
  }
  return colors[grade.value] || '#ffffff'
})

const accuracy = computed(() => {
  const total = gameStore.judgments.perfect + gameStore.judgments.great + gameStore.judgments.good + gameStore.judgments.miss
  if (total === 0) return 0
  return Math.round(
    ((gameStore.judgments.perfect * 100 + gameStore.judgments.great * 75 + gameStore.judgments.good * 50) / (total * 100)) * 100
  )
})
</script>

<template>
  <div class="page-container">
    <ParticleBackground />
    <div class="result-content">
      <h1 class="result-title fade-in">结算</h1>

      <div class="grade-display fade-in fade-in-delay-1" :style="{ color: gradeColor }">
        {{ grade }}
      </div>

      <div class="score-display fade-in fade-in-delay-2">
        <div class="score-value">{{ gameStore.score.toLocaleString() }}</div>
        <div class="score-label">总分</div>
      </div>

      <div class="stats-grid fade-in fade-in-delay-3">
        <div class="stat-item">
          <div class="stat-value perfect">PERFECT</div>
          <div class="stat-count">{{ gameStore.judgments.perfect }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-value great">GREAT</div>
          <div class="stat-count">{{ gameStore.judgments.great }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-value good">GOOD</div>
          <div class="stat-count">{{ gameStore.judgments.good }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-value miss">MISS</div>
          <div class="stat-count">{{ gameStore.judgments.miss }}</div>
        </div>
      </div>

      <div class="extra-stats fade-in fade-in-delay-3">
        <div class="extra-item">
          <span class="extra-label">最大 COMBO</span>
          <span class="extra-value">{{ gameStore.maxCombo }}</span>
        </div>
        <div class="extra-item">
          <span class="extra-label">准确率</span>
          <span class="extra-value">{{ accuracy }}%</span>
        </div>
      </div>

      <div class="result-buttons fade-in fade-in-delay-4">
        <button class="btn btn-gold" @click="router.push('/')">🏠 返回主页</button>
        <button class="btn" @click="retryGame()">🔄 再来一次</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px;
}

.result-title {
  font-size: 36px;
  font-weight: 700;
  background: linear-gradient(135deg, #ff6b9d, #c44dff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.grade-display {
  font-size: 120px;
  font-weight: 900;
  line-height: 1;
  filter: drop-shadow(0 0 30px currentColor);
  animation: gradeAppear 0.8s ease-out;
}

@keyframes gradeAppear {
  0% { transform: scale(3); opacity: 0; }
  60% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}

.score-display {
  text-align: center;
}

.score-value {
  font-size: 48px;
  font-weight: 700;
  color: #ffffff;
}

.score-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 20px 30px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.stat-value.perfect { color: #ffd700; }
.stat-value.great { color: #ff6b9d; }
.stat-value.good { color: #c44dff; }
.stat-value.miss { color: #ff4444; }

.stat-count {
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
}

.extra-stats {
  display: flex;
  gap: 40px;
}

.extra-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.extra-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.extra-value {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
}

.result-buttons {
  display: flex;
  gap: 16px;
  margin-top: 10px;
}
</style>

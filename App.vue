<script setup lang="ts">
import { ref } from 'vue'
import IntroAnimation from './components/IntroAnimation.vue'

const showIntro = ref(true)
const introDone = ref(false)

function onIntroDone() {
  showIntro.value = false
  introDone.value = true
}
</script>

<template>
  <IntroAnimation v-if="showIntro" @done="onIntroDone" />
  <router-view v-if="introDone" />
</template>

<style>
#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>

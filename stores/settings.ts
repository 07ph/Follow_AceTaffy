import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const bgmVolume = ref(0.8)
  const sfxVolume = ref(0.5)
  const scrollSpeed = ref(5)
  const offset = ref(0)
  const inputOffset = ref(0)

  function setBgmVolume(v: number) { bgmVolume.value = Math.max(0, Math.min(1, v)) }
  function setSfxVolume(v: number) { sfxVolume.value = Math.max(0, Math.min(1, v)) }
  function setScrollSpeed(v: number) { scrollSpeed.value = Math.max(1, Math.min(15, v)) }
  function setOffset(v: number) { offset.value = v }
  function setInputOffset(v: number) { inputOffset.value = v }

  return {
    bgmVolume, sfxVolume, scrollSpeed, offset, inputOffset,
    setBgmVolume, setSfxVolume, setScrollSpeed, setOffset, setInputOffset
  }
})

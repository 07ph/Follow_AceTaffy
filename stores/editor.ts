import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Note, NoteType } from '../types'

export const useEditorStore = defineStore('editor', () => {
  const notes = ref<Note[]>([])
  const selectedNoteId = ref<string | null>(null)
  const multiSelectedIds = ref<string[]>([])
  const selectedType = ref<NoteType>('tap')
  const selectedTrack = ref(0)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const bpm = ref(120)
  const gridDivision = ref(4) // 1/4 拍
  const zoom = ref(1)
  const undoStack = ref<Note[][]>([])
  const redoStack = ref<Note[][]>([])

  function selectNote(id: string | null) { selectedNoteId.value = id }
  function setType(t: NoteType) { selectedType.value = t }
  function setTrack(t: number) { selectedTrack.value = t }
  function setPlaying(p: boolean) { isPlaying.value = p }
  function setCurrentTime(t: number) { currentTime.value = t }
  function setBpm(b: number) { bpm.value = b }
  function setGridDivision(d: number) { gridDivision.value = d }
  function setZoom(z: number) { zoom.value = Math.max(0.25, Math.min(4, z)) }

  function pushUndo() {
    undoStack.value.push(JSON.parse(JSON.stringify(notes.value)))
    redoStack.value = []
    if (undoStack.value.length > 50) undoStack.value.shift()
  }

  function undo() {
    if (undoStack.value.length === 0) return
    redoStack.value.push(JSON.parse(JSON.stringify(notes.value)))
    notes.value = undoStack.value.pop()!
  }

  function redo() {
    if (redoStack.value.length === 0) return
    undoStack.value.push(JSON.parse(JSON.stringify(notes.value)))
    notes.value = redoStack.value.pop()!
  }

  function addNote(note: Note) {
    pushUndo()
    notes.value.push(note)
  }

  function removeNote(id: string) {
    pushUndo()
    notes.value = notes.value.filter(n => n.id !== id)
    if (selectedNoteId.value === id) selectedNoteId.value = null
  }

  function updateNote(id: string, updates: Partial<Note>) {
    pushUndo()
    const note = notes.value.find(n => n.id === id)
    if (note) Object.assign(note, updates)
  }

  function loadNotes(newNotes: Note[]) {
    notes.value = newNotes
    undoStack.value = []
    redoStack.value = []
  }

  function clearNotes() {
    pushUndo()
    notes.value = []
  }

  function toggleMultiSelect(id: string) {
    const idx = multiSelectedIds.value.indexOf(id)
    if (idx >= 0) {
      multiSelectedIds.value.splice(idx, 1)
    } else {
      multiSelectedIds.value.push(id)
    }
  }

  function clearMultiSelection() {
    multiSelectedIds.value = []
  }

  function deleteSelected() {
    const ids = new Set(multiSelectedIds.value)
    if (selectedNoteId.value) ids.add(selectedNoteId.value)
    if (ids.size === 0) return
    pushUndo()
    notes.value = notes.value.filter(n => !ids.has(n.id))
    if (ids.has(selectedNoteId.value!)) selectedNoteId.value = null
    multiSelectedIds.value = []
  }

  function duplicateNotes(ids: string[]) {
    if (ids.length === 0) return
    pushUndo()
    for (const id of ids) {
      const note = notes.value.find(n => n.id === id)
      if (!note) continue
      const copy: Note = JSON.parse(JSON.stringify(note))
      copy.id = 'note_' + Math.random().toString(36).substr(2, 9)
      copy.time += 0.5
      notes.value.push(copy)
    }
  }

  function moveNotes(ids: string[], deltaTime: number, deltaTrack?: number) {
    if (ids.length === 0) return
    pushUndo()
    for (const id of ids) {
      const note = notes.value.find(n => n.id === id)
      if (!note) continue
      note.time += deltaTime
      if (deltaTrack !== undefined) {
        note.track = Math.max(0, Math.min(1, note.track + deltaTrack))
      }
    }
    notes.value.sort((a, b) => a.time - b.time)
  }

  function selectAllNotes() {
    multiSelectedIds.value = notes.value.map(n => n.id)
  }

  return {
    notes, selectedNoteId, multiSelectedIds, selectedType, selectedTrack,
    isPlaying, currentTime, bpm, gridDivision, zoom,
    undoStack, redoStack,
    selectNote, setType, setTrack, setPlaying, setCurrentTime,
    setBpm, setGridDivision, setZoom,
    pushUndo, undo, redo, addNote, removeNote, updateNote,
    loadNotes, clearNotes,
    toggleMultiSelect, clearMultiSelection, deleteSelected, selectAllNotes,
    duplicateNotes, moveNotes
  }
})

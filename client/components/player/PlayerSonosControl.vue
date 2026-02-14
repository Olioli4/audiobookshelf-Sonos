<template>
  <div class="flex items-center">
    <!-- Sonos Volume Slider (visible when in Sonos mode) -->
    <div v-if="isSonosMode" class="flex items-center mr-2 pointer-events-auto">
      <span class="material-symbols text-lg text-gray-400 mr-1">volume_down</span>
      <input type="range" min="0" max="100" :value="sonosVolume" class="sonos-volume-slider w-16 lg:w-24" @input="onVolumeInput" @change="onVolumeChange" @mousedown.stop @click.stop />
      <span class="text-xs text-gray-400 ml-1 w-8">{{ sonosVolume }}%</span>
    </div>

    <!-- Sonos Output Toggle Button -->
    <ui-tooltip direction="top" :text="sonosEnabled ? (connectionError ? 'Sonos - Connection Issue' : 'Switch to Sonos') : 'Sonos not configured'">
      <button :disabled="!sonosEnabled || isOperationPending" :aria-label="isSonosMode ? 'Switch to Browser' : 'Switch to Sonos'" class="mx-1 lg:mx-2" :class="sonosEnabled && !isOperationPending ? 'text-gray-300 hover:text-white cursor-pointer' : 'text-gray-600 cursor-not-allowed'" @mousedown.prevent @mouseup.prevent @click.stop="toggleSonosMode">
        <span v-if="isOperationPending" class="material-symbols text-2xl text-yellow-400 animate-pulse">sync</span>
        <span v-else-if="connectionError && isSonosMode" class="material-symbols text-2xl text-orange-400">speaker_group</span>
        <span v-else-if="isSonosMode" class="material-symbols text-2xl text-success">speaker_group</span>
        <span v-else class="material-symbols text-2xl">speaker</span>
      </button>
    </ui-tooltip>

    <!-- Sonos Room Selector Modal -->
    <modals-modal v-model="showRoomSelector" name="sonos-room-selector" :width="400" :height="'unset'">
      <template #outer>
        <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
          <p class="text-3xl text-white truncate pointer-events-none">Select Sonos Room</p>
        </div>
      </template>
      <div class="p-4">
        <div v-if="loadingRooms" class="flex items-center justify-center py-8">
          <ui-loading-indicator />
          <span class="ml-2 text-gray-300">Loading Sonos rooms...</span>
        </div>
        <div v-else-if="!sonosRooms.length" class="py-8 text-center text-gray-400">
          <span class="material-symbols text-4xl mb-2">speaker_off</span>
          <p>No Sonos rooms found</p>
          <p class="text-sm mt-2">Make sure node-sonos-http-api is running</p>
        </div>
        <div v-else class="space-y-2">
          <button v-for="room in sonosRooms" :key="room.id || room.uuid" class="w-full flex items-center justify-between p-3 rounded-lg transition-colors" :class="selectedRoom === room.name ? 'bg-success bg-opacity-20 border border-success' : 'bg-primary hover:bg-bg border border-transparent'" @click="selectRoom(room)">
            <div class="flex items-center">
              <span class="material-symbols text-2xl mr-3" :class="selectedRoom === room.name ? 'text-success' : 'text-gray-400'">
                {{ room.state === 'PLAYING' ? 'volume_up' : 'speaker' }}
              </span>
              <div class="text-left">
                <p class="font-semibold" :class="selectedRoom === room.name ? 'text-success' : 'text-white'">
                  {{ room.name }}
                  <span v-if="room.isCoordinator && room.isGrouped" class="text-xs text-yellow-500 ml-1">(Group Leader)</span>
                </p>
                <p class="text-xs text-gray-400">
                  {{ room.state === 'PLAYING' ? 'Playing' : 'Idle' }}
                  <span v-if="room.isGrouped && room.groupMembers"> • Grouped with: {{ room.groupMembers.filter((m) => m !== room.name).join(', ') }}</span>
                  <span v-else-if="room.members && room.members.length > 1"> • Group: {{ room.members.join(', ') }}</span>
                </p>
              </div>
            </div>
            <div class="flex items-center">
              <span class="text-sm text-gray-400 mr-2">Vol: {{ room.volume }}%</span>
              <span v-if="selectedRoom === room.name" class="material-symbols text-success">check_circle</span>
            </div>
          </button>
        </div>
        <div v-if="sonosRooms.length" class="mt-4 flex justify-end space-x-2">
          <ui-btn small color="primary" @click="showRoomSelector = false">Cancel</ui-btn>
          <ui-btn small color="success" :disabled="!selectedRoom" @click="confirmRoomSelection">
            <span class="material-symbols mr-1">play_arrow</span>
            Play on {{ selectedRoom || 'Sonos' }}
          </ui-btn>
        </div>
      </div>
    </modals-modal>
  </div>
</template>

<script>
export default {
  props: {
    libraryItemId: String,
    episodeId: String,
    currentTime: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      isSonosMode: false,
      showRoomSelector: false,
      loadingRooms: false,
      isOperationPending: false,
      connectionError: false,
      pollFailCount: 0,
      sonosRooms: [],
      selectedRoom: null,
      sonosStatus: null,
      sonosIsPlaying: false,
      sonosVolume: 30,
      volumeChangeTimeout: null,
      volumeBlockPolling: false,
      pollInterval: null,
      trackStartOffset: 0,
      trackDuration: 0,
      trackCount: 1
    }
  },
  computed: {
    sonosEnabled() {
      // Check if Sonos is configured on the server
      return this.sonosStatus?.enabled === true
    },
    defaultRoom() {
      return this.sonosStatus?.defaultRoom || null
    },
    defaultGroup() {
      return this.sonosStatus?.defaultGroup || []
    }
  },
  async mounted() {
    // Check Sonos status on mount
    await this.checkSonosStatus()
  },
  beforeDestroy() {
    this.stopPolling()
  },
  methods: {
    startPolling() {
      if (this.pollInterval) return
      // Poll every 2 seconds for Sonos state
      this.pollInterval = setInterval(() => this.pollSonosState(), 2000)
    },
    stopPolling() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval)
        this.pollInterval = null
      }
    },
    async pollSonosState() {
      if (!this.isSonosMode || !this.selectedRoom) return
      try {
        const state = await this.$axios.$get(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/state`)
        const isPlaying = state?.playbackState === 'PLAYING'
        
        // Reset connection error on successful poll
        if (this.connectionError || this.pollFailCount > 0) {
          this.connectionError = false
          this.pollFailCount = 0
          console.log('[SonosControl] Connection restored')
        }
        
        console.log('[SonosControl] pollSonosState:', state?.playbackState, 'elapsedTime:', state?.elapsedTime, 'trackStartOffset:', this.trackStartOffset, 'isPlaying:', isPlaying, 'was:', this.sonosIsPlaying)

        // Always emit time update for position sync - convert to total time using trackStartOffset
        if (typeof state?.elapsedTime === 'number') {
          const totalTime = this.trackStartOffset + state.elapsedTime
          this.$emit('sonos-time-update', { currentTime: totalTime, duration: state?.currentTrack?.duration || 0 })
          
          // Detect track completion for multi-track audiobooks
          // If playback stopped and we're near the end of the track, advance to next track
          if (this.trackCount > 1 && !isPlaying && this.sonosIsPlaying) {
            const trackEndThreshold = 3 // within 3 seconds of track end
            const nearTrackEnd = this.trackDuration > 0 && (this.trackDuration - state.elapsedTime) < trackEndThreshold
            if (nearTrackEnd) {
              const nextTrackStart = this.trackStartOffset + this.trackDuration
              console.log(`[SonosControl] Track completed, advancing to next track at position ${nextTrackStart}`)
              // Small delay to prevent race conditions
              setTimeout(() => this.playOnSonos(nextTrackStart), 500)
              return
            }
          }
        }

        // Update volume if changed externally (e.g., from Sonos app)
        if (typeof state?.volume === 'number') {
          if (this.volumeBlockPolling) {
            console.log('[SonosControl] poll: volume update blocked, state.volume:', state.volume, 'current:', this.sonosVolume)
          } else if (state.volume !== this.sonosVolume) {
            console.log('[SonosControl] poll: updating volume from', this.sonosVolume, 'to', state.volume)
            this.sonosVolume = state.volume
          }
        }

        if (isPlaying !== this.sonosIsPlaying) {
          console.log('[SonosControl] State changed, emitting sonos-state-changed:', isPlaying)
          this.sonosIsPlaying = isPlaying
          this.$emit('sonos-state-changed', { isPlaying })
        }
      } catch (error) {
        this.pollFailCount++
        console.error('[SonosControl] Polling error:', error.message, 'failCount:', this.pollFailCount)
        
        // After 3 consecutive failures, show connection error
        if (this.pollFailCount >= 3 && !this.connectionError) {
          this.connectionError = true
          this.$toast.warning('Lost connection to Sonos - retrying...')
        }
      }
    },
    async checkSonosStatus() {
      try {
        this.sonosStatus = await this.$axios.$get('/api/sonos/status')
      } catch (error) {
        console.log('Sonos not available:', error.message)
        this.sonosStatus = { enabled: false }
      }
    },
    async toggleSonosMode() {
      if (!this.sonosEnabled) return

      if (this.isSonosMode) {
        // Get current Sonos position before stopping
        let currentPosition = 0
        try {
          const state = await this.$axios.$get(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/state`)
          // Sonos returns track-relative time, add trackStartOffset to get total audiobook time
          const trackRelativeTime = state?.elapsedTime || 0
          currentPosition = this.trackStartOffset + trackRelativeTime
          console.log(`[SonosControl] Converting position: trackRelative=${trackRelativeTime}, trackStartOffset=${this.trackStartOffset}, total=${currentPosition}`)
        } catch (e) {
          console.warn('Failed to get Sonos position:', e)
        }

        // Stop Sonos playback before switching back to browser
        if (this.selectedRoom && this.sonosIsPlaying) {
          await this.sonosPause()
        }
        // Switch back to browser
        this.isSonosMode = false
        this.sonosIsPlaying = false
        this.selectedRoom = null
        this.trackStartOffset = 0
        this.stopPolling()
        this.$emit('output-changed', { type: 'browser', currentTime: currentPosition })
        this.$toast.info('Switched to browser playback')
      } else {
        // Use server default room first, then localStorage, then room selector
        await this.loadSonosRooms()

        const serverDefault = this.defaultRoom
        const savedRoom = localStorage.getItem('sonosSelectedRoom')
        const preferredRoom = serverDefault || savedRoom

        if (preferredRoom && this.sonosRooms.find((r) => r.name === preferredRoom)) {
          // Auto-play on preferred room (server default or saved)
          this.selectedRoom = preferredRoom
          await this.confirmRoomSelection()
        } else if (this.sonosRooms.length === 1) {
          // Auto-play on only room
          this.selectedRoom = this.sonosRooms[0].name
          await this.confirmRoomSelection()
        } else {
          // Show room selector
          this.showRoomSelector = true
        }
      }
    },
    async loadSonosRooms() {
      this.loadingRooms = true
      try {
        const response = await this.$axios.$get('/api/sonos/zones')
        // Use rooms array for individual speakers, or fallback to zones for backward compatibility
        this.sonosRooms = response.rooms || response.zones || []

        // Restore previously selected room if still available
        const serverDefault = this.defaultRoom
        const savedRoom = localStorage.getItem('sonosSelectedRoom')
        const preferredRoom = serverDefault || savedRoom
        if (preferredRoom && this.sonosRooms.find((r) => r.name === preferredRoom)) {
          this.selectedRoom = preferredRoom
        } else if (this.sonosRooms.length === 1) {
          this.selectedRoom = this.sonosRooms[0].name
        }
      } catch (error) {
        console.error('Failed to load Sonos rooms:', error)
        this.$toast.error('Failed to connect to Sonos')
        this.sonosRooms = []
      } finally {
        this.loadingRooms = false
      }
    },
    selectRoom(room) {
      this.selectedRoom = room.name
    },
    async confirmRoomSelection() {
      if (!this.selectedRoom) return

      // Save selection for next time (fallback when no server default)
      localStorage.setItem('sonosSelectedRoom', this.selectedRoom)

      this.showRoomSelector = false
      this.isSonosMode = true

      // Apply grouping from server config if available
      if (this.defaultGroup && this.defaultGroup.length > 0) {
        await this.applyGrouping()
      }

      this.$emit('output-changed', {
        type: 'sonos',
        room: this.selectedRoom
      })

      // Play current track on Sonos if we have a library item
      if (this.libraryItemId) {
        await this.playOnSonos()
      }

      // Get initial volume from Sonos (with small delay to let playback start)
      setTimeout(async () => {
        await this.fetchSonosVolume()
        console.log('[SonosControl] Initial volume fetched:', this.sonosVolume)
      }, 500)

      // Start polling for Sonos state changes
      this.startPolling()

      const groupedRooms = this.defaultGroup?.length ? ` + ${this.defaultGroup.join(', ')}` : ''
      this.$toast.success(`Now playing on ${this.selectedRoom}${groupedRooms}`)
    },
    async applyGrouping() {
      if (!this.selectedRoom || !this.defaultGroup?.length) return

      try {
        // Group the default rooms with the selected room
        await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/group`, {
          rooms: this.defaultGroup
        })
      } catch (error) {
        console.error('Failed to apply Sonos grouping:', error)
        // Continue playback even if grouping fails
      }
    },
    async playOnSonos(overrideStartTime = null) {
      if (!this.selectedRoom || !this.libraryItemId) return
      if (this.isOperationPending) return

      this.isOperationPending = true
      try {
        const startTime = overrideStartTime !== null ? overrideStartTime : (this.currentTime || 0)
        console.log(`[SonosControl] playOnSonos called: startTime=${startTime}, libraryItemId=${this.libraryItemId}, episodeId=${this.episodeId}`)

        const payload = {
          libraryItemId: this.libraryItemId,
          startTime
        }
        // Include episodeId if this is a podcast
        if (this.episodeId) {
          payload.episodeId = this.episodeId
        }

        console.log('[SonosControl] Sending payload:', JSON.stringify(payload))

        const response = await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/play-item`, payload)
        this.sonosIsPlaying = true

        // Store trackStartOffset for converting Sonos position back to total time
        this.trackStartOffset = response?.trackStartOffset || 0
        this.trackDuration = response?.trackDuration || 0
        this.trackCount = response?.trackCount || 1
        console.log('[SonosControl] Stored trackStartOffset:', this.trackStartOffset, 'trackDuration:', this.trackDuration, 'trackCount:', this.trackCount)

        // Emit session info so PlayerHandler can track it
        if (response?.sessionId) {
          this.$emit('sonos-session-started', { sessionId: response.sessionId })
        }

        this.$emit('sonos-state-changed', { isPlaying: true })
      } catch (error) {
        console.error('Failed to play on Sonos:', error)
        this.$toast.error('Failed to play on Sonos')
      } finally {
        this.isOperationPending = false
      }
    },
    async sonosPlay() {
      if (!this.selectedRoom) return
      if (this.isOperationPending) return
      
      this.isOperationPending = true
      try {
        await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/play`)
        this.sonosIsPlaying = true
        this.$emit('sonos-state-changed', { isPlaying: true })
      } catch (error) {
        console.error('Failed to resume Sonos:', error)
        this.$toast.error('Failed to resume playback')
      } finally {
        this.isOperationPending = false
      }
    },
    async sonosPause() {
      if (!this.selectedRoom) return
      if (this.isOperationPending) return
      
      this.isOperationPending = true
      try {
        await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/pause`)
        this.sonosIsPlaying = false
        this.$emit('sonos-state-changed', { isPlaying: false })
      } catch (error) {
        console.error('Failed to pause Sonos:', error)
        this.$toast.error('Failed to pause playback')
      } finally {
        this.isOperationPending = false
      }
    },
    async sonosSeek(position) {
      if (!this.selectedRoom) return
      if (this.isOperationPending) return
      
      // For multi-track audiobooks, check if seeking to a different track
      if (this.trackCount > 1) {
        const trackEndOffset = this.trackStartOffset + this.trackDuration
        const isWithinCurrentTrack = position >= this.trackStartOffset && position < trackEndOffset
        
        if (!isWithinCurrentTrack) {
          // Cross-track seek - need to reload stream with correct track
          console.log(`[SonosControl] Cross-track seek: position=${position}, current track range=[${this.trackStartOffset}, ${trackEndOffset})`)
          await this.playOnSonos(position)
          return
        }
        
        // Within current track - convert total position to track-relative
        const trackRelativePosition = position - this.trackStartOffset
        console.log(`[SonosControl] Within-track seek: total=${position}, trackRelative=${trackRelativePosition}`)
        this.isOperationPending = true
        try {
          await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/seek`, {
            position: Math.floor(trackRelativePosition)
          })
        } catch (error) {
          console.error('Failed to seek Sonos:', error)
          this.$toast.error('Failed to seek')
        } finally {
          this.isOperationPending = false
        }
        return
      }
      
      // Single-track - seek directly
      this.isOperationPending = true
      try {
        await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/seek`, {
          position: Math.floor(position)
        })
      } catch (error) {
        console.error('Failed to seek Sonos:', error)
        this.$toast.error('Failed to seek')
      } finally {
        this.isOperationPending = false
      }
    },
    async sonosJumpForward() {
      if (!this.selectedRoom) return
      try {
        const state = await this.$axios.$get(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/state`)
        const trackRelativePos = state?.elapsedTime || 0
        const jumpSec = this.$store.getters['user/getUserSetting']('jumpForwardAmount') || 10
        // Convert to total time, add jump, then use sonosSeek which handles cross-track boundaries
        const totalCurrentPos = this.trackStartOffset + trackRelativePos
        const newTotalPos = totalCurrentPos + jumpSec
        console.log(`[SonosControl] jumpForward: trackRelative=${trackRelativePos}, total=${totalCurrentPos}, newTotal=${newTotalPos}`)
        await this.sonosSeek(newTotalPos)
      } catch (error) {
        console.error('Failed to jump forward on Sonos:', error)
      }
    },
    async sonosJumpBackward() {
      if (!this.selectedRoom) return
      try {
        const state = await this.$axios.$get(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/state`)
        const trackRelativePos = state?.elapsedTime || 0
        const jumpSec = this.$store.getters['user/getUserSetting']('jumpBackwardAmount') || 10
        // Convert to total time, subtract jump, then use sonosSeek which handles cross-track boundaries
        const totalCurrentPos = this.trackStartOffset + trackRelativePos
        const newTotalPos = Math.max(0, totalCurrentPos - jumpSec)
        console.log(`[SonosControl] jumpBackward: trackRelative=${trackRelativePos}, total=${totalCurrentPos}, newTotal=${newTotalPos}`)
        await this.sonosSeek(newTotalPos)
      } catch (error) {
        console.error('Failed to jump backward on Sonos:', error)
      }
    },
    onVolumeInput(event) {
      // Update UI immediately for responsiveness
      const vol = parseInt(event.target.value)
      console.log('[SonosControl] onVolumeInput:', vol)
      this.sonosVolume = vol
      // Block polling from overwriting during drag
      this.volumeBlockPolling = true
    },
    onVolumeChange(event) {
      // Called when user releases the slider
      const volume = parseInt(event.target.value)
      console.log('[SonosControl] onVolumeChange:', volume)
      this.sonosVolume = volume

      // Cancel any pending API call
      if (this.volumeChangeTimeout) {
        clearTimeout(this.volumeChangeTimeout)
      }

      // Send volume to Sonos after brief delay
      this.volumeChangeTimeout = setTimeout(() => {
        this.setSonosVolume(volume)
      }, 100)
    },
    async setSonosVolume(volume) {
      if (!this.selectedRoom) {
        console.log('[SonosControl] setSonosVolume: no room selected')
        return
      }
      console.log('[SonosControl] setSonosVolume:', volume, 'room:', this.selectedRoom)

      // Block polling immediately
      this.volumeBlockPolling = true
      this.sonosVolume = volume

      try {
        await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/volume`, { volume })
        console.log('[SonosControl] Volume set successfully to', volume)
      } catch (error) {
        console.error('Failed to set Sonos volume:', error)
        this.$toast.error('Failed to set volume')
      }

      // Keep blocking polling for 2 seconds after setting volume
      setTimeout(() => {
        this.volumeBlockPolling = false
        console.log('[SonosControl] Volume polling unblocked')
      }, 2000)
    },
    async fetchSonosVolume() {
      if (!this.selectedRoom) return
      // Don't overwrite if user is adjusting volume
      if (this.volumeBlockPolling) {
        console.log('[SonosControl] fetchSonosVolume skipped - blocked')
        return
      }
      try {
        const state = await this.$axios.$get(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/state`)
        console.log('[SonosControl] fetchSonosVolume got state.volume:', state?.volume)
        if (typeof state?.volume === 'number' && state.volume !== this.sonosVolume) {
          console.log('[SonosControl] Setting sonosVolume from', this.sonosVolume, 'to', state.volume)
          this.sonosVolume = state.volume
        }
      } catch (error) {
        console.error('Failed to get Sonos volume:', error)
      }
    }
  }
}
</script>

<style scoped>
.sonos-volume-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: #4b5563;
  border-radius: 2px;
  cursor: pointer;
}

.sonos-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #22c55e;
  border-radius: 50%;
  cursor: pointer;
}

.sonos-volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #22c55e;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}
</style>

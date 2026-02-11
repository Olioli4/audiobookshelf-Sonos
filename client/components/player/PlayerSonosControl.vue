<template>
  <div>
    <!-- Sonos Output Toggle Button -->
    <ui-tooltip direction="top" :text="sonosEnabled ? 'Switch to Sonos' : 'Sonos not configured'">
      <button :disabled="!sonosEnabled" :aria-label="isSonosMode ? 'Switch to Browser' : 'Switch to Sonos'" class="mx-1 lg:mx-2" :class="sonosEnabled ? 'text-gray-300 hover:text-white cursor-pointer' : 'text-gray-600 cursor-not-allowed'" @mousedown.prevent @mouseup.prevent @click.stop="toggleSonosMode">
        <span v-if="isSonosMode" class="material-symbols text-2xl text-success">speaker_group</span>
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
                  <span v-if="room.isGrouped && room.groupMembers"> • Grouped with: {{ room.groupMembers.filter(m => m !== room.name).join(', ') }}</span>
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
      sonosRooms: [],
      selectedRoom: null,
      sonosStatus: null,
      sonosIsPlaying: false
    }
  },
  computed: {
    sonosEnabled() {
      // Check if Sonos is configured on the server
      return this.sonosStatus?.enabled === true
    }
  },
  async mounted() {
    // Check Sonos status on mount
    await this.checkSonosStatus()
  },
  methods: {
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
        // Stop Sonos playback before switching back to browser
        if (this.selectedRoom && this.sonosIsPlaying) {
          await this.sonosPause()
        }
        // Switch back to browser
        this.isSonosMode = false
        this.sonosIsPlaying = false
        this.selectedRoom = null
        this.$emit('output-changed', { type: 'browser' })
        this.$toast.info('Switched to browser playback')
      } else {
        // Check for saved room - auto-play without modal
        const savedRoom = localStorage.getItem('sonosSelectedRoom')
        await this.loadSonosRooms()
        
        if (savedRoom && this.sonosRooms.find((r) => r.name === savedRoom)) {
          // Auto-play on saved room
          this.selectedRoom = savedRoom
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
        const savedRoom = localStorage.getItem('sonosSelectedRoom')
        if (savedRoom && this.sonosRooms.find((r) => r.name === savedRoom)) {
          this.selectedRoom = savedRoom
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

      // Save selection for next time
      localStorage.setItem('sonosSelectedRoom', this.selectedRoom)

      this.showRoomSelector = false
      this.isSonosMode = true

      this.$emit('output-changed', {
        type: 'sonos',
        room: this.selectedRoom
      })

      // Play current track on Sonos if we have a library item
      if (this.libraryItemId) {
        await this.playOnSonos()
      }

      this.$toast.success(`Now playing on ${this.selectedRoom}`)
    },
    async playOnSonos() {
      if (!this.selectedRoom || !this.libraryItemId) return

      try {
        const payload = {
          libraryItemId: this.libraryItemId,
          startTime: this.currentTime || 0
        }
        // Include episodeId if this is a podcast
        if (this.episodeId) {
          payload.episodeId = this.episodeId
        }
        await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/play-item`, payload)
        this.sonosIsPlaying = true
        this.$emit('sonos-state-changed', { isPlaying: true })
      } catch (error) {
        console.error('Failed to play on Sonos:', error)
        this.$toast.error('Failed to play on Sonos')
      }
    },
    async sonosPlay() {
      if (!this.selectedRoom) return
      try {
        await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/play`)
        this.sonosIsPlaying = true
        this.$emit('sonos-state-changed', { isPlaying: true })
      } catch (error) {
        console.error('Failed to resume Sonos:', error)
      }
    },
    async sonosPause() {
      if (!this.selectedRoom) return
      try {
        await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/pause`)
        this.sonosIsPlaying = false
        this.$emit('sonos-state-changed', { isPlaying: false })
      } catch (error) {
        console.error('Failed to pause Sonos:', error)
      }
    },
    async sonosSeek(position) {
      if (!this.selectedRoom) return
      try {
        await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/seek`, {
          position: Math.floor(position)
        })
      } catch (error) {
        console.error('Failed to seek Sonos:', error)
      }
    },
    async sonosSetVolume(volume) {
      if (!this.selectedRoom) return
      try {
        await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/volume`, {
          volume: Math.round(volume * 100)
        })
      } catch (error) {
        console.error('Failed to set Sonos volume:', error)
      }
    },
    async sonosJumpForward() {
      if (!this.selectedRoom) return
      try {
        const state = await this.$axios.$get(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/state`)
        const currentPos = state?.elapsedTime || 0
        const jumpSec = this.$store.getters['user/getUserSetting']('jumpForwardAmount') || 10
        await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/seek`, {
          position: Math.floor(currentPos + jumpSec)
        })
      } catch (error) {
        console.error('Failed to jump forward on Sonos:', error)
      }
    },
    async sonosJumpBackward() {
      if (!this.selectedRoom) return
      try {
        const state = await this.$axios.$get(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/state`)
        const currentPos = state?.elapsedTime || 0
        const jumpSec = this.$store.getters['user/getUserSetting']('jumpBackwardAmount') || 10
        await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(this.selectedRoom)}/seek`, {
          position: Math.max(0, Math.floor(currentPos - jumpSec))
        })
      } catch (error) {
        console.error('Failed to jump backward on Sonos:', error)
      }
    }
  }
}
</script>

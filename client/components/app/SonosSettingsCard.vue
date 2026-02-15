<template>
  <div class="mb-6 bg-bg rounded-lg shadow-lg border border-gray-700">
    <!-- Sonos Integration -->
    <div class="flex items-center px-4 py-3 border-b border-gray-700 bg-primary bg-opacity-40 rounded-t-lg">
      <span class="material-symbols text-2xl text-primary mr-3">speaker_group</span>
      <h2 class="text-lg font-semibold">Sonos Integration</h2>
    </div>

    <div class="p-4">
      <!-- Enable -->
      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="localSettings.sonosEnabled" @input="toggleSonosEnabled" />
        <p class="pl-4">Enable Sonos speaker output</p>
      </div>

      <!-- Sonos Settings (shown when enabled) -->
      <div v-show="localSettings.sonosEnabled" class="mt-4 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ui-text-input-with-label v-model="localSettings.sonosApiUrl" label="Sonos HTTP API URL" placeholder="http://192.168.1.x:5005" class="max-w-80" @blur="updateSonosSettings" />

          <ui-text-input-with-label v-model="localSettings.sonosServerUrl" label="Server URL for Sonos" placeholder="http://192.168.1.x:13378" class="max-w-80" @blur="updateSonosSettings" />
        </div>

        <!-- Test Connection -->
        <div class="flex items-center gap-4">
          <ui-btn small :loading="testingSonos" @click="testSonosConnection">
            <span class="material-symbols text-lg mr-1">wifi_tethering</span>
            Test Connection
          </ui-btn>
          <span v-if="sonosTestResult" :class="sonosTestResult.success ? 'text-success' : 'text-error'" class="text-sm">
            {{ sonosTestResult.message }}
          </span>
        </div>

        <!-- Speaker Selection -->
        <div v-if="sonosRooms.length > 0">
          <label class="text-sm font-medium text-gray-300 block mb-2">Select Speakers</label>
          <p class="text-xs text-gray-400 mb-2">Check one speaker or multiple to group them</p>
          <div class="flex flex-wrap gap-3">
            <label v-for="room in sonosRooms" :key="room.name" class="flex items-center cursor-pointer bg-primary rounded px-3 py-1.5 hover:bg-primary/80">
              <input type="checkbox" :checked="selectedSpeakers.includes(room.name)" @change="toggleSpeaker(room.name)" class="mr-2" />
              {{ room.name }}
            </label>
          </div>
          <p v-if="selectedSpeakers.length > 1" class="text-xs text-yellow-400 mt-2">{{ selectedSpeakers.length }} speakers selected - will be grouped for playback</p>
        </div>

        <!-- Advanced Timing Configuration -->
        <div class="mt-6 border-t border-gray-700 pt-4">
          <div class="flex items-center cursor-pointer mb-3" @click="showAdvancedSonosSettings = !showAdvancedSonosSettings">
            <span class="material-symbols text-lg mr-2">{{ showAdvancedSonosSettings ? 'expand_less' : 'expand_more' }}</span>
            <h3 class="text-sm font-semibold text-gray-300">Advanced Timing Configuration</h3>
          </div>

          <div v-show="showAdvancedSonosSettings" class="space-y-4 pl-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-xs text-gray-400">Seek Initial Delay (ms)</label>
                <input type="number" v-model.number="localSettings.sonosSeekInitialDelayMs" min="0" max="10000" step="100" class="w-full bg-bg border border-gray-600 rounded px-2 py-1 text-sm" @change="updateSonosTimingSettings" />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-400">Seek Retry Delay (ms)</label>
                <input type="number" v-model.number="localSettings.sonosSeekRetryDelayMs" min="0" max="10000" step="100" class="w-full bg-bg border border-gray-600 rounded px-2 py-1 text-sm" @change="updateSonosTimingSettings" />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-400">Position Tolerance (seconds)</label>
                <input type="number" v-model.number="localSettings.sonosPositionToleranceSeconds" min="1" max="60" step="1" class="w-full bg-bg border border-gray-600 rounded px-2 py-1 text-sm" @change="updateSonosTimingSettings" />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-400">Max Seek Attempts</label>
                <input type="number" v-model.number="localSettings.sonosMaxSeekAttempts" min="1" max="10" step="1" class="w-full bg-bg border border-gray-600 rounded px-2 py-1 text-sm" @change="updateSonosTimingSettings" />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-400">Post-Seek Resume Delay (ms)</label>
                <input type="number" v-model.number="localSettings.sonosPostSeekResumeDelayMs" min="0" max="5000" step="100" class="w-full bg-bg border border-gray-600 rounded px-2 py-1 text-sm" @change="updateSonosTimingSettings" />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-400">Group Formation Delay (ms)</label>
                <input type="number" v-model.number="localSettings.sonosGroupFormationDelayMs" min="0" max="5000" step="100" class="w-full bg-bg border border-gray-600 rounded px-2 py-1 text-sm" @change="updateSonosTimingSettings" />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-400">Group Command Delay (ms)</label>
                <input type="number" v-model.number="localSettings.sonosGroupCommandDelayMs" min="0" max="2000" step="50" class="w-full bg-bg border border-gray-600 rounded px-2 py-1 text-sm" @change="updateSonosTimingSettings" />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-400">Request Timeout (ms)</label>
                <input type="number" v-model.number="localSettings.sonosRequestTimeoutMs" min="1000" max="30000" step="1000" class="w-full bg-bg border border-gray-600 rounded px-2 py-1 text-sm" @change="updateSonosTimingSettings" />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-400">Poll Interval (ms)</label>
                <input type="number" v-model.number="localSettings.sonosPollIntervalMs" min="500" max="5000" step="100" class="w-full bg-bg border border-gray-600 rounded px-2 py-1 text-sm" @change="updateSonosTimingSettings" />
              </div>
            </div>

            <!-- Reset Defaults -->
            <div class="pt-2">
              <ui-btn small color="primary" @click="resetSonosTimingDefaults">
                <span class="material-symbols text-sm mr-1">restart_alt</span>
                Reset to Defaults
              </ui-btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    serverSettings: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      testingSonos: false,
      sonosTestResult: null,
      sonosRooms: [],
      showAdvancedSonosSettings: false,
      localSettings: {
        sonosEnabled: false,
        sonosApiUrl: '',
        sonosServerUrl: '',
        sonosDefaultRoom: '',
        sonosDefaultGroup: [],
        sonosSeekInitialDelayMs: 3000,
        sonosSeekRetryDelayMs: 2000,
        sonosPositionToleranceSeconds: 10,
        sonosGroupFormationDelayMs: 500,
        sonosMaxSeekAttempts: 3,
        sonosRequestTimeoutMs: 10000,
        sonosPostSeekResumeDelayMs: 500,
        sonosGroupCommandDelayMs: 200,
        sonosPollIntervalMs: 1000
      }
    }
  },
  watch: {
    serverSettings: {
      handler(newVal) {
        if (newVal) {
          this.initLocalSettings()
        }
      },
      immediate: true
    }
  },
  computed: {
    // Combined list of all selected speakers (defaultRoom + defaultGroup)
    selectedSpeakers() {
      const speakers = []
      if (this.localSettings.sonosDefaultRoom) {
        speakers.push(this.localSettings.sonosDefaultRoom)
      }
      if (this.localSettings.sonosDefaultGroup && this.localSettings.sonosDefaultGroup.length) {
        speakers.push(...this.localSettings.sonosDefaultGroup.filter((s) => s !== this.localSettings.sonosDefaultRoom))
      }
      return speakers
    }
  },
  methods: {
    initLocalSettings() {
      this.localSettings = {
        sonosEnabled: this.serverSettings.sonosEnabled || false,
        sonosApiUrl: this.serverSettings.sonosApiUrl || '',
        sonosServerUrl: this.serverSettings.sonosServerUrl || '',
        sonosDefaultRoom: this.serverSettings.sonosDefaultRoom || '',
        sonosDefaultGroup: this.serverSettings.sonosDefaultGroup || [],
        sonosSeekInitialDelayMs: this.serverSettings.sonosSeekInitialDelayMs || 3000,
        sonosSeekRetryDelayMs: this.serverSettings.sonosSeekRetryDelayMs || 2000,
        sonosPositionToleranceSeconds: this.serverSettings.sonosPositionToleranceSeconds || 10,
        sonosGroupFormationDelayMs: this.serverSettings.sonosGroupFormationDelayMs || 500,
        sonosMaxSeekAttempts: this.serverSettings.sonosMaxSeekAttempts || 3,
        sonosRequestTimeoutMs: this.serverSettings.sonosRequestTimeoutMs || 10000,
        sonosPostSeekResumeDelayMs: this.serverSettings.sonosPostSeekResumeDelayMs || 500,
        sonosGroupCommandDelayMs: this.serverSettings.sonosGroupCommandDelayMs || 200,
        sonosPollIntervalMs: this.serverSettings.sonosPollIntervalMs || 1000
      }

      // Fetch rooms if Sonos is enabled
      if (this.localSettings.sonosEnabled && this.localSettings.sonosApiUrl) {
        this.fetchSonosRooms()
      }
    },
    toggleSonosEnabled(val) {
      this.updateServerSettings({ sonosEnabled: val })
    },
    async updateSonosSettings() {
      const sonosSettings = {}
      if (this.localSettings.sonosApiUrl !== this.serverSettings.sonosApiUrl) {
        sonosSettings.sonosApiUrl = this.localSettings.sonosApiUrl
      }
      if (this.localSettings.sonosServerUrl !== this.serverSettings.sonosServerUrl) {
        sonosSettings.sonosServerUrl = this.localSettings.sonosServerUrl
      }
      if (this.localSettings.sonosDefaultRoom !== this.serverSettings.sonosDefaultRoom) {
        sonosSettings.sonosDefaultRoom = this.localSettings.sonosDefaultRoom
      }
      if (JSON.stringify(this.localSettings.sonosDefaultGroup) !== JSON.stringify(this.serverSettings.sonosDefaultGroup)) {
        sonosSettings.sonosDefaultGroup = this.localSettings.sonosDefaultGroup
      }

      if (Object.keys(sonosSettings).length > 0) {
        this.sonosTestResult = null
        await this.updateServerSettings(sonosSettings)
      }
    },
    async toggleSpeaker(roomName) {
      const isSelected = this.selectedSpeakers.includes(roomName)
      const room = this.sonosRooms.find((r) => r.name === roomName)

      if (isSelected) {
        // Removing speaker
        // If this speaker is currently playing or grouped, stop and ungroup it
        if (room?.state === 'PLAYING' || room?.isGrouped) {
          try {
            // Stop playback first if playing
            if (room?.state === 'PLAYING') {
              await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(roomName)}/stop`)
            }
            // Then leave the group
            if (room?.isGrouped) {
              await this.$axios.$post(`/api/sonos/room/${encodeURIComponent(roomName)}/leave`)
            }
          } catch (error) {
            console.error('Failed to stop/leave group:', error)
          }
        }

        if (this.localSettings.sonosDefaultRoom === roomName) {
          // Removing the primary speaker - promote first group member
          const group = [...(this.localSettings.sonosDefaultGroup || [])]
          if (group.length > 0) {
            this.localSettings.sonosDefaultRoom = group[0]
            this.localSettings.sonosDefaultGroup = group.slice(1)
          } else {
            this.localSettings.sonosDefaultRoom = ''
          }
        } else {
          // Removing from group
          this.localSettings.sonosDefaultGroup = (this.localSettings.sonosDefaultGroup || []).filter((s) => s !== roomName)
        }
      } else {
        // Adding speaker
        if (!this.localSettings.sonosDefaultRoom) {
          // No primary speaker yet - set as primary
          this.localSettings.sonosDefaultRoom = roomName
        } else {
          // Already have primary - add to group
          this.localSettings.sonosDefaultGroup = [...(this.localSettings.sonosDefaultGroup || []), roomName]
        }
      }

      await this.updateSonosSettings()
      // Refetch rooms to get updated grouping state
      await this.fetchSonosRooms()
    },
    async fetchSonosRooms() {
      if (!this.localSettings.sonosEnabled || !this.localSettings.sonosApiUrl) {
        this.sonosRooms = []
        return
      }
      try {
        const response = await this.$axios.$get('/api/sonos/zones')
        this.sonosRooms = response.rooms || response.zones || []
      } catch (error) {
        console.error('Failed to fetch Sonos rooms:', error)
        this.sonosRooms = []
      }
    },
    async testSonosConnection() {
      this.testingSonos = true
      this.sonosTestResult = null

      try {
        const response = await this.$axios.$get('/api/sonos/zones')
        const rooms = response.rooms || response.zones || []
        this.sonosRooms = rooms
        this.sonosTestResult = {
          success: true,
          message: rooms.length > 0 ? `Connected! Found ${rooms.length} room(s)` : 'Connected but no rooms found'
        }
      } catch (error) {
        console.error('Sonos test failed:', error)
        this.sonosTestResult = {
          success: false,
          message: error.response?.data?.error || 'Connection failed - check URL'
        }
      } finally {
        this.testingSonos = false
      }
    },
    async updateSonosTimingSettings() {
      const timingSettings = {
        sonosSeekInitialDelayMs: this.localSettings.sonosSeekInitialDelayMs,
        sonosSeekRetryDelayMs: this.localSettings.sonosSeekRetryDelayMs,
        sonosPositionToleranceSeconds: this.localSettings.sonosPositionToleranceSeconds,
        sonosGroupFormationDelayMs: this.localSettings.sonosGroupFormationDelayMs,
        sonosMaxSeekAttempts: this.localSettings.sonosMaxSeekAttempts,
        sonosRequestTimeoutMs: this.localSettings.sonosRequestTimeoutMs,
        sonosPostSeekResumeDelayMs: this.localSettings.sonosPostSeekResumeDelayMs,
        sonosGroupCommandDelayMs: this.localSettings.sonosGroupCommandDelayMs,
        sonosPollIntervalMs: this.localSettings.sonosPollIntervalMs
      }
      this.updateServerSettings(timingSettings)
    },
    resetSonosTimingDefaults() {
      this.localSettings.sonosSeekInitialDelayMs = 3000
      this.localSettings.sonosSeekRetryDelayMs = 2000
      this.localSettings.sonosPositionToleranceSeconds = 10
      this.localSettings.sonosGroupFormationDelayMs = 500
      this.localSettings.sonosMaxSeekAttempts = 3
      this.localSettings.sonosRequestTimeoutMs = 10000
      this.localSettings.sonosPostSeekResumeDelayMs = 500
      this.localSettings.sonosGroupCommandDelayMs = 200
      this.localSettings.sonosPollIntervalMs = 1000
      this.updateSonosTimingSettings()
    },
    updateServerSettings(payload) {
      this.$store.dispatch('updateServerSettings', payload).then((response) => {
        if (response.error) {
          console.error('Failed to update server settings', response.error)
          this.$toast.error(response.error)
          this.initLocalSettings()
        }
      })
    }
  }
}
</script>

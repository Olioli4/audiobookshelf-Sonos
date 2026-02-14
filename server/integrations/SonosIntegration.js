'use strict'

const Logger = require('../Logger')
const Database = require('../Database')
const BaseStreamTarget = require('./BaseStreamTarget')

/**
 * Sonos integration for streaming audio to Sonos speakers
 * Uses node-sonos-http-api as a bridge
 * 
 * @see https://github.com/jishi/node-sonos-http-api
 * @extends BaseStreamTarget
 */
class SonosIntegration extends BaseStreamTarget {
  constructor() {
    super()
    this.id = 'sonos'
    this.name = 'Sonos'
    /** @type {string|null} Sonos HTTP API base URL (cached) */
    this._apiUrl = null
    /** @type {string|null} Audiobookshelf server URL (accessible from Sonos) */
    this._serverUrl = null
    /** @type {number} Request timeout in milliseconds */
    this.requestTimeout = 10000
  }

  /**
   * Get current API URL - dynamically reads from database settings
   * @returns {string|null}
   */
  get apiUrl() {
    try {
      // Check database settings first (for dynamic updates)
      const dbUrl = Database.serverSettings?.sonosApiUrl
      if (dbUrl) {
        return this._normalizeUrl(dbUrl)
      }
    } catch (e) {
      // Database not ready yet
    }
    return this._apiUrl
  }

  /**
   * Get server URL for Sonos to reach audiobookshelf
   * @returns {string|null}
   */
  get serverUrl() {
    try {
      const dbUrl = Database.serverSettings?.sonosServerUrl
      if (dbUrl) {
        return this._normalizeUrl(dbUrl)
      }
    } catch (e) {
      // Database not ready yet
    }
    return this._serverUrl
  }

  /**
   * Check if Sonos is enabled
   * @returns {boolean}
   */
  get enabled() {
    try {
      const isEnabled = Database.serverSettings?.sonosEnabled
      if (isEnabled && this.apiUrl) {
        return true
      }
    } catch (e) {
      // Database not ready yet
    }
    return this._enabled && this._apiUrl !== null
  }

  /**
   * Normalize URL - add protocol if missing, remove trailing slash
   * @param {string} url 
   * @returns {string}
   * @private
   */
  _normalizeUrl(url) {
    if (!url) return null
    let normalized = url.trim().replace(/\/$/, '')
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'http://' + normalized
    }
    return normalized
  }

  /**
   * Initialize with settings
   * @param {Object} settings 
   * @param {string} [settings.sonosApiUrl] - URL of node-sonos-http-api
   * @param {string} [settings.serverUrl] - URL of audiobookshelf server accessible from network
   */
  init(settings) {
    if (settings.sonosApiUrl) {
      this._apiUrl = this._normalizeUrl(settings.sonosApiUrl)
      this._serverUrl = this._normalizeUrl(settings.serverUrl)
      this._enabled = true
      Logger.info(`[SonosIntegration] Initialized with API URL: ${this._apiUrl}`)
    } else {
      this._enabled = false
      Logger.debug('[SonosIntegration] Not configured - Sonos integration disabled')
    }
  }

  /**
   * Make HTTP request to Sonos API
   * @param {string} endpoint - API endpoint (starts with /)
   * @returns {Promise<Object|null>}
   * @private
   */
  async _request(endpoint) {
    Logger.debug(`[SonosIntegration] _request called for endpoint: ${endpoint}`)
    Logger.debug(`[SonosIntegration] enabled check: ${this.enabled}, apiUrl: ${this.apiUrl}`)
    
    if (!this.enabled) {
      Logger.warn('[SonosIntegration] Sonos not configured - enabled is false')
      Logger.debug(`[SonosIntegration] _enabled: ${this._enabled}, _apiUrl: ${this._apiUrl}`)
      return null
    }

    const url = `${this.apiUrl}${endpoint}`
    Logger.debug(`[SonosIntegration] Request: ${url.substring(0, 200)}${url.length > 200 ? '...' : ''}`)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.requestTimeout)
      
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        Logger.error(`[SonosIntegration] Request failed: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`)
        return null
      }
      const data = await response.json()
      Logger.debug(`[SonosIntegration] Response received, data type: ${typeof data}, isArray: ${Array.isArray(data)}, length: ${Array.isArray(data) ? data.length : 'N/A'}`)
      return data
    } catch (error) {
      if (error.name === 'AbortError') {
        Logger.error(`[SonosIntegration] Request timeout after ${this.requestTimeout}ms`)
      } else {
        Logger.error(`[SonosIntegration] Request error: ${error.name}: ${error.message}`)
      }
      return null
    }
  }

  /**
   * URL-encode a room name for API requests
   * @param {string} roomName 
   * @returns {string}
   * @private
   */
  _encodeRoom(roomName) {
    return encodeURIComponent(roomName)
  }

  // ============================================
  // BaseStreamTarget Implementation
  // ============================================

  /**
   * Get all Sonos zones/rooms
   * @returns {Promise<Array<{id: string, name: string, state: string, volume: number, members: string[]}>>}
   */
  async getDevices() {
    const data = await this._request('/zones')
    if (!data || !Array.isArray(data)) {
      return []
    }

    const rooms = []
    for (const zone of data) {
      if (zone.coordinator) {
        rooms.push({
          id: zone.uuid,
          name: zone.coordinator.roomName,
          state: zone.coordinator.state?.playbackState || 'STOPPED',
          volume: zone.coordinator.state?.volume || 0,
          isCoordinator: true,
          members: zone.members?.map(m => m.roomName) || []
        })
      }
    }
    
    Logger.debug(`[SonosIntegration] Found ${rooms.length} rooms: ${rooms.map(r => r.name).join(', ')}`)
    return rooms
  }

  /**
   * Get state of a specific room
   * @param {string} deviceId - Room name
   * @returns {Promise<Object|null>}
   */
  async getDeviceState(deviceId) {
    return this._request(`/${this._encodeRoom(deviceId)}/state`)
  }

  /**
   * Play audio URL on Sonos speaker
   * @param {string} deviceId - Room name
   * @param {string} audioUrl - URL to audio stream
   * @param {Object} [metadata] - Optional metadata (unused for Sonos HTTP API)
   * @returns {Promise<boolean>}
   */
  async playUrl(deviceId, audioUrl, metadata = {}) {
    const encodedUrl = encodeURIComponent(audioUrl)
    const result = await this._request(`/${this._encodeRoom(deviceId)}/setavtransporturi/${encodedUrl}`)
    if (result === null) {
      return false
    }
    // setavtransporturi only loads - need play to start
    Logger.debug(`[SonosIntegration] URI set, sending play command to ${deviceId}`)
    return await this.play(deviceId)
  }

  /**
   * Resume playback
   * @param {string} deviceId - Room name
   * @returns {Promise<boolean>}
   */
  async play(deviceId) {
    const result = await this._request(`/${this._encodeRoom(deviceId)}/play`)
    return result !== null
  }

  /**
   * Pause playback
   * @param {string} deviceId - Room name
   * @returns {Promise<boolean>}
   */
  async pause(deviceId) {
    const result = await this._request(`/${this._encodeRoom(deviceId)}/pause`)
    return result !== null
  }

  /**
   * Set volume (0-100) for the group
   * Uses groupVolume to set volume on all grouped speakers
   * @param {string} deviceId - Room name (coordinator)
   * @param {number} volume
   * @returns {Promise<boolean>}
   */
  async setVolume(deviceId, volume) {
    // Use groupVolume to set volume on all grouped speakers
    const result = await this._request(`/${this._encodeRoom(deviceId)}/groupVolume/${Math.round(volume)}`)
    return result !== null
  }

  /**
   * Seek to position
   * @param {string} deviceId - Room name
   * @param {number} positionSeconds 
   * @returns {Promise<boolean>}
   */
  async seek(deviceId, positionSeconds) {
    const result = await this._request(`/${this._encodeRoom(deviceId)}/timeseek/${Math.round(positionSeconds)}`)
    return result !== null
  }

  /**
   * Next track
   * @param {string} deviceId - Room name
   * @returns {Promise<boolean>}
   */
  async next(deviceId) {
    const result = await this._request(`/${this._encodeRoom(deviceId)}/next`)
    return result !== null
  }

  /**
   * Previous track
   * @param {string} deviceId - Room name
   * @returns {Promise<boolean>}
   */
  async previous(deviceId) {
    const result = await this._request(`/${this._encodeRoom(deviceId)}/previous`)
    return result !== null
  }

  // ============================================
  // Sonos-specific Grouping Features
  // ============================================

  /**
   * Sonos supports speaker grouping
   * @returns {boolean}
   */
  supportsGrouping() {
    return true
  }

  /**
   * Join a room to another room's group
   * @param {string} roomName - Room to join
   * @param {string} targetRoom - Room to join to
   * @returns {Promise<boolean>}
   */
  async joinRoom(roomName, targetRoom) {
    Logger.info(`[SonosIntegration] Joining ${roomName} to ${targetRoom}'s group`)
    const result = await this._request(`/${this._encodeRoom(roomName)}/join/${this._encodeRoom(targetRoom)}`)
    return result !== null
  }

  /**
   * Add a room to this room's group
   * @param {string} coordinatorRoom - Coordinator room
   * @param {string} roomToAdd - Room to add
   * @returns {Promise<boolean>}
   */
  async addToGroup(coordinatorRoom, roomToAdd) {
    Logger.info(`[SonosIntegration] Adding ${roomToAdd} to ${coordinatorRoom}'s group`)
    const result = await this._request(`/${this._encodeRoom(coordinatorRoom)}/add/${this._encodeRoom(roomToAdd)}`)
    return result !== null
  }

  /**
   * Remove a room from its group
   * @param {string} roomName - Room to isolate
   * @returns {Promise<boolean>}
   */
  async leaveGroup(roomName) {
    Logger.info(`[SonosIntegration] Isolating ${roomName} from its group`)
    const result = await this._request(`/${this._encodeRoom(roomName)}/leave`)
    return result !== null
  }

  /**
   * Create a group from multiple rooms
   * @param {string} coordinatorId - Coordinator room name
   * @param {string[]} memberIds - Room names to add
   * @returns {Promise<boolean>}
   */
  async createGroup(coordinatorId, memberIds) {
    if (!memberIds || memberIds.length === 0) {
      return true
    }

    Logger.info(`[SonosIntegration] Creating group: ${coordinatorId} + ${memberIds.join(', ')}`)
    
    for (const room of memberIds) {
      if (room !== coordinatorId) {
        const success = await this.addToGroup(coordinatorId, room)
        if (!success) {
          Logger.error(`[SonosIntegration] Failed to add ${room} to group`)
          return false
        }
        // Small delay between commands
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    return true
  }

  /**
   * Disband a room's group
   * @param {string} coordinatorId - Coordinator room name
   * @returns {Promise<boolean>}
   */
  async disbandGroup(coordinatorId) {
    const devices = await this.getDevices()
    const zone = devices.find(z => z.name === coordinatorId)
    
    if (!zone || !zone.members || zone.members.length <= 1) {
      return true
    }

    Logger.info(`[SonosIntegration] Disbanding group: ${zone.members.join(', ')}`)
    
    for (const member of zone.members) {
      if (member !== coordinatorId) {
        await this.leaveGroup(member)
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    return true
  }
}

module.exports = SonosIntegration

'use strict'

/**
 * Base class for external streaming targets (Sonos, Chromecast, AirPlay, etc.)
 * Provides a consistent interface for casting audio to external devices
 * 
 * @abstract
 */
class BaseStreamTarget {
  constructor() {
    if (new.target === BaseStreamTarget) {
      throw new Error('BaseStreamTarget is abstract and cannot be instantiated directly')
    }
    
    /** @type {string} Unique identifier for this integration */
    this.id = 'base'
    /** @type {string} Human-readable name */
    this.name = 'Base Stream Target'
    /** @type {boolean} Whether the integration is enabled */
    this._enabled = false
  }

  /**
   * Check if the integration is enabled
   * @returns {boolean}
   */
  get enabled() {
    return this._enabled
  }

  /**
   * Initialize the integration with settings
   * @param {Object} settings - Configuration settings
   * @abstract
   */
  init(settings) {
    throw new Error('init() must be implemented by subclass')
  }

  /**
   * Get available devices/zones
   * @returns {Promise<Array<{id: string, name: string, state?: string}>>}
   * @abstract
   */
  async getDevices() {
    throw new Error('getDevices() must be implemented by subclass')
  }

  /**
   * Get current state of a device
   * @param {string} deviceId - Device identifier
   * @returns {Promise<Object|null>}
   * @abstract
   */
  async getDeviceState(deviceId) {
    throw new Error('getDeviceState() must be implemented by subclass')
  }

  /**
   * Play audio URL on a device
   * @param {string} deviceId - Device identifier
   * @param {string} audioUrl - URL to audio stream
   * @param {Object} [metadata] - Optional metadata (title, artist, etc.)
   * @returns {Promise<boolean>}
   * @abstract
   */
  async playUrl(deviceId, audioUrl, metadata = {}) {
    throw new Error('playUrl() must be implemented by subclass')
  }

  /**
   * Resume playback on a device
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>}
   * @abstract
   */
  async play(deviceId) {
    throw new Error('play() must be implemented by subclass')
  }

  /**
   * Pause playback on a device
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>}
   * @abstract
   */
  async pause(deviceId) {
    throw new Error('pause() must be implemented by subclass')
  }

  /**
   * Stop playback on a device
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>}
   */
  async stop(deviceId) {
    // Default implementation - pause is often equivalent to stop for streaming
    return this.pause(deviceId)
  }

  /**
   * Set volume on a device
   * @param {string} deviceId - Device identifier
   * @param {number} volume - Volume level (0-100)
   * @returns {Promise<boolean>}
   * @abstract
   */
  async setVolume(deviceId, volume) {
    throw new Error('setVolume() must be implemented by subclass')
  }

  /**
   * Seek to position in current track
   * @param {string} deviceId - Device identifier
   * @param {number} positionSeconds - Position in seconds
   * @returns {Promise<boolean>}
   * @abstract
   */
  async seek(deviceId, positionSeconds) {
    throw new Error('seek() must be implemented by subclass')
  }

  /**
   * Skip to next track
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>}
   */
  async next(deviceId) {
    // Not all targets support multi-track, return false by default
    return false
  }

  /**
   * Skip to previous track
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>}
   */
  async previous(deviceId) {
    // Not all targets support multi-track, return false by default
    return false
  }

  /**
   * Check if this target supports device grouping
   * @returns {boolean}
   */
  supportsGrouping() {
    return false
  }

  /**
   * Create a device group
   * @param {string} coordinatorId - ID of the coordinator device
   * @param {string[]} memberIds - IDs of devices to add to group
   * @returns {Promise<boolean>}
   */
  async createGroup(coordinatorId, memberIds) {
    return false
  }

  /**
   * Disband a device group
   * @param {string} coordinatorId - ID of the coordinator device
   * @returns {Promise<boolean>}
   */
  async disbandGroup(coordinatorId) {
    return false
  }
}

module.exports = BaseStreamTarget

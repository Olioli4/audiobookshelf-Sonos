'use strict'

const EventEmitter = require('events')
const Logger = require('../Logger')

/**
 * Abstract base class for streaming targets (Sonos, Chromecast, etc.)
 * Provides common interface and event handling for external playback devices
 * 
 * @extends EventEmitter
 * @abstract
 */
class BaseStreamTarget extends EventEmitter {
  constructor() {
    super()
    /** @type {string} Unique identifier for this integration */
    this.id = 'base'
    /** @type {string} Display name */
    this.name = 'Base Stream Target'
    /** @type {boolean} Whether this integration is enabled */
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
   * Initialize the integration
   * @returns {Promise<void>}
   */
  async init() {
    Logger.debug(`[${this.name}] Initializing...`)
  }

  /**
   * Shutdown the integration
   * @returns {Promise<void>}
   */
  async shutdown() {
    Logger.debug(`[${this.name}] Shutting down...`)
    this._enabled = false
  }

  /**
   * Check if the integration is available and working
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return this._enabled
  }

  // ============================================
  // Abstract methods - must be implemented by subclasses
  // ============================================

  /**
   * Get all available devices
   * @returns {Promise<Array<{id: string, name: string, state: string}>>}
   * @abstract
   */
  async getDevices() {
    throw new Error('getDevices() must be implemented by subclass')
  }

  /**
   * Get state of a specific device
   * @param {string} deviceId 
   * @returns {Promise<Object|null>}
   * @abstract
   */
  async getDeviceState(deviceId) {
    throw new Error('getDeviceState() must be implemented by subclass')
  }

  /**
   * Play audio URL on device
   * @param {string} deviceId 
   * @param {string} audioUrl 
   * @param {Object} metadata 
   * @returns {Promise<boolean>}
   * @abstract
   */
  async play(deviceId, audioUrl, metadata = {}) {
    throw new Error('play() must be implemented by subclass')
  }

  /**
   * Pause playback on device
   * @param {string} deviceId 
   * @returns {Promise<boolean>}
   * @abstract
   */
  async pause(deviceId) {
    throw new Error('pause() must be implemented by subclass')
  }

  /**
   * Stop playback on device
   * @param {string} deviceId 
   * @returns {Promise<boolean>}
   * @abstract
   */
  async stop(deviceId) {
    throw new Error('stop() must be implemented by subclass')
  }

  /**
   * Resume playback on device
   * @param {string} deviceId 
   * @returns {Promise<boolean>}
   * @abstract
   */
  async resume(deviceId) {
    throw new Error('resume() must be implemented by subclass')
  }

  /**
   * Set volume on device
   * @param {string} deviceId 
   * @param {number} volume - 0-100
   * @returns {Promise<boolean>}
   * @abstract
   */
  async setVolume(deviceId, volume) {
    throw new Error('setVolume() must be implemented by subclass')
  }

  /**
   * Seek to position on device
   * @param {string} deviceId 
   * @param {number} positionSeconds 
   * @returns {Promise<boolean>}
   * @abstract
   */
  async seek(deviceId, positionSeconds) {
    throw new Error('seek() must be implemented by subclass')
  }
}

module.exports = BaseStreamTarget

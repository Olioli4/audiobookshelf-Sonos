'use strict'

const Path = require('path')
const express = require('express')
const Logger = require('../Logger')
const Database = require('../Database')

/**
 * @typedef {import('../integrations/SonosIntegration')} SonosIntegration
 * @typedef {import('../managers/PlaybackSessionManager')} PlaybackSessionManager
 */

/**
 * Sonos Router - handles all Sonos-related API endpoints
 * 
 * Routes:
 * - GET  /api/sonos/status - Check integration status
 * - GET  /api/sonos/zones - List available speakers
 * - GET  /api/sonos/room/:roomName/state - Get room state
 * - POST /api/sonos/room/:roomName/play-item - Play library item
 * - POST /api/sonos/room/:roomName/play - Resume playback
 * - POST /api/sonos/room/:roomName/pause - Pause playback
 * - POST /api/sonos/room/:roomName/volume - Set volume
 * - POST /api/sonos/room/:roomName/seek - Seek to position
 * - POST /api/sonos/room/:roomName/next - Next track
 * - POST /api/sonos/room/:roomName/previous - Previous track
 * - POST /api/sonos/room/:roomName/join/:targetRoom - Join to group
 * - POST /api/sonos/room/:roomName/add/:roomToAdd - Add to group
 * - POST /api/sonos/room/:roomName/leave - Leave group
 * - POST /api/sonos/room/:roomName/group - Create group
 * - POST /api/sonos/room/:roomName/ungroup - Disband group
 */
class SonosRouter {
  /**
   * @param {SonosIntegration} sonosIntegration 
   * @param {PlaybackSessionManager} playbackSessionManager 
   */
  constructor(sonosIntegration, playbackSessionManager) {
    /** @type {SonosIntegration} */
    this.sonos = sonosIntegration
    /** @type {PlaybackSessionManager} */
    this.playbackSessionManager = playbackSessionManager
    /** @type {express.Router} */
    this.router = express.Router()
    
    this._initRoutes()
  }

  /**
   * Initialize all routes
   * @private
   */
  _initRoutes() {
    // Status endpoint (always available)
    this.router.get('/status', this._getStatus.bind(this))

    // Middleware to check if Sonos is enabled for all other routes
    this.router.use(this._requireEnabled.bind(this))

    // Zone/Room discovery
    this.router.get('/zones', this._getZones.bind(this))
    this.router.get('/room/:roomName/state', this._getRoomState.bind(this))

    // Playback control
    this.router.post('/room/:roomName/play-item', this._playItem.bind(this))
    this.router.post('/room/:roomName/play', this._play.bind(this))
    this.router.post('/room/:roomName/pause', this._pause.bind(this))
    this.router.post('/room/:roomName/volume', this._setVolume.bind(this))
    this.router.post('/room/:roomName/seek', this._seek.bind(this))
    this.router.post('/room/:roomName/next', this._next.bind(this))
    this.router.post('/room/:roomName/previous', this._previous.bind(this))

    // Grouping
    this.router.post('/room/:roomName/join/:targetRoom', this._joinRoom.bind(this))
    this.router.post('/room/:roomName/add/:roomToAdd', this._addToGroup.bind(this))
    this.router.post('/room/:roomName/leave', this._leaveGroup.bind(this))
    this.router.post('/room/:roomName/group', this._createGroup.bind(this))
    this.router.post('/room/:roomName/ungroup', this._disbandGroup.bind(this))
  }

  // ============================================
  // Middleware
  // ============================================

  /**
   * Middleware to check if Sonos integration is enabled
   * @private
   */
  _requireEnabled(req, res, next) {
    if (!this.sonos.enabled) {
      return res.status(503).json({ 
        error: 'Sonos integration not configured',
        hint: 'Enable Sonos in Settings → Sonos Integration'
      })
    }
    next()
  }

  // ============================================
  // Route Handlers
  // ============================================

  /**
   * GET /api/sonos/status
   * @private
   */
  _getStatus(req, res) {
    try {
      res.json({
        enabled: this.sonos?.enabled || false,
        configured: !!this.sonos?.apiUrl,
        serverUrlConfigured: !!this.sonos?.serverUrl,
        supportsGrouping: this.sonos?.supportsGrouping?.() || false
      })
    } catch (error) {
      Logger.error('[SonosRouter] Error in _getStatus:', error)
      res.status(500).json({ error: 'Failed to get Sonos status', details: error.message })
    }
  }

  /**
   * GET /api/sonos/zones
   * @private
   */
  async _getZones(req, res) {
    try {
      // Debug logging to trace Sonos connection issues
      Logger.debug(`[SonosRouter] _getZones called`)
      Logger.debug(`[SonosRouter] sonos.enabled: ${this.sonos?.enabled}`)
      Logger.debug(`[SonosRouter] sonos.apiUrl: ${this.sonos?.apiUrl}`)
      Logger.debug(`[SonosRouter] Database.serverSettings.sonosEnabled: ${require('../Database').serverSettings?.sonosEnabled}`)
      Logger.debug(`[SonosRouter] Database.serverSettings.sonosApiUrl: ${require('../Database').serverSettings?.sonosApiUrl}`)
      
      const zones = await this.sonos.getDevices()
      Logger.debug(`[SonosRouter] getDevices returned ${zones?.length || 0} zones`)
      res.json({ zones })
    } catch (error) {
      Logger.error('[SonosRouter] Error getting zones:', error)
      res.status(500).json({ error: 'Failed to get Sonos zones' })
    }
  }

  /**
   * GET /api/sonos/room/:roomName/state
   * @private
   */
  async _getRoomState(req, res) {
    try {
      const { roomName } = req.params
      const state = await this.sonos.getDeviceState(roomName)
      if (!state) {
        return res.status(404).json({ error: 'Room not found or unavailable' })
      }
      res.json(state)
    } catch (error) {
      Logger.error('[SonosRouter] Error getting room state:', error)
      res.status(500).json({ error: 'Failed to get room state' })
    }
  }

  /**
   * POST /api/sonos/room/:roomName/play-item
   * Body: { libraryItemId: string, episodeId?: string, startTime?: number }
   * @private
   */
  async _playItem(req, res) {
    try {
      const { roomName } = req.params
      const { libraryItemId, episodeId, startTime } = req.body

      // Validation
      if (!libraryItemId) {
        return res.status(400).json({ error: 'libraryItemId is required' })
      }

      const libraryItem = await Database.libraryItemModel.getExpandedById(libraryItemId)
      if (!libraryItem) {
        return res.status(404).json({ error: 'Library item not found' })
      }

      if (libraryItem.mediaType === 'podcast' && !episodeId) {
        return res.status(400).json({ error: 'episodeId is required for podcasts' })
      }

      // Create playback session
      const deviceInfo = {
        id: `sonos-${roomName}`,
        deviceDescription: `Sonos: ${roomName}`,
        deviceType: 'sonos-speaker',
        clientName: 'Sonos',
        manufacturer: 'Sonos',
        model: roomName
      }

      const session = await this.playbackSessionManager.startSession(
        req.user,
        deviceInfo,
        libraryItem,
        episodeId,
        { forceDirectPlay: true, mediaPlayer: 'sonos' }
      )

      if (!session) {
        return res.status(500).json({ error: 'Failed to create playback session' })
      }

      if (!session.audioTracks?.length) {
        return res.status(500).json({ error: 'No audio tracks available' })
      }

      // Build streaming URL
      const streamUrl = this._buildStreamUrl(req, session)

      // Auto-group if configured
      await this._autoGroupIfConfigured(roomName)

      // Play on Sonos
      const success = await this.sonos.playUrl(roomName, streamUrl)
      
      if (success) {
        Logger.info(`[SonosRouter] Started playback on ${roomName}`)
        
        // Seek to start position if provided (after a small delay for playback to initialize)
        if (startTime && startTime > 0) {
          setTimeout(async () => {
            try {
              await this.sonos.seek(roomName, startTime)
              Logger.info(`[SonosRouter] Seeked to ${startTime}s on ${roomName}`)
            } catch (seekError) {
              Logger.error(`[SonosRouter] Failed to seek to start position: ${seekError.message}`)
            }
          }, 1000)
        }
        
        res.json({
          success: true,
          sessionId: session.id,
          streamUrl,
          trackCount: session.audioTracks.length,
          displayTitle: session.displayTitle
        })
      } else {
        Logger.error(`[SonosRouter] Playback failed for: ${streamUrl}`)
        res.status(500).json({
          error: 'Failed to play on Sonos — check sonosServerUrl setting',
          streamUrl,
          hint: 'Set sonosServerUrl to your server\'s LAN IP (e.g., http://192.168.1.x:13378)'
        })
      }
    } catch (error) {
      Logger.error('[SonosRouter] Error playing item:', error)
      res.status(500).json({ error: 'Failed to play item on Sonos' })
    }
  }

  /**
   * Build the streaming URL for Sonos
   * @param {express.Request} req 
   * @param {Object} session - Playback session
   * @returns {string}
   * @private
   */
  _buildStreamUrl(req, session) {
    const basePath = global.RouterBasePath || ''
    
    // Prefer configured sonosServerUrl
    let baseUrl = this.sonos.serverUrl
    if (!baseUrl) {
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
      const host = req.headers['x-forwarded-host'] || req.headers.host
      baseUrl = `${protocol}://${host}`
      Logger.warn('[SonosRouter] No sonosServerUrl configured, using request host')
    }

    const firstTrack = session.audioTracks[0]
    const trackIndex = firstTrack.index ?? 1
    
    // Sonos requires file extension for content-type detection
    const fileExt = firstTrack.metadata?.path ? Path.extname(firstTrack.metadata.path) : '.mp3'
    
    return `${baseUrl}${basePath}/public/session/${session.id}/track/${trackIndex}${fileExt}`
  }

  /**
   * Auto-group speakers if configured in settings
   * @param {string} roomName - Coordinator room
   * @private
   */
  async _autoGroupIfConfigured(roomName) {
    const defaultGroup = Database.serverSettings?.sonosDefaultGroup || []
    if (defaultGroup.length > 0) {
      Logger.info(`[SonosRouter] Auto-grouping: ${roomName} + ${defaultGroup.join(', ')}`)
      await this.sonos.createGroup(roomName, defaultGroup)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  /**
   * POST /api/sonos/room/:roomName/play
   * @private
   */
  async _play(req, res) {
    try {
      const success = await this.sonos.play(req.params.roomName)
      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error playing:', error)
      res.status(500).json({ error: 'Failed to play' })
    }
  }

  /**
   * POST /api/sonos/room/:roomName/pause
   * @private
   */
  async _pause(req, res) {
    try {
      const success = await this.sonos.pause(req.params.roomName)
      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error pausing:', error)
      res.status(500).json({ error: 'Failed to pause' })
    }
  }

  /**
   * POST /api/sonos/room/:roomName/volume
   * Body: { volume: number (0-100) }
   * @private
   */
  async _setVolume(req, res) {
    try {
      const { volume } = req.body
      if (volume === undefined || volume < 0 || volume > 100) {
        return res.status(400).json({ error: 'Volume must be between 0 and 100' })
      }
      const success = await this.sonos.setVolume(req.params.roomName, volume)
      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error setting volume:', error)
      res.status(500).json({ error: 'Failed to set volume' })
    }
  }

  /**
   * POST /api/sonos/room/:roomName/seek
   * Body: { position: number (seconds) }
   * @private
   */
  async _seek(req, res) {
    try {
      const { position } = req.body
      if (position === undefined || position < 0) {
        return res.status(400).json({ error: 'Position must be a positive number' })
      }
      const success = await this.sonos.seek(req.params.roomName, position)
      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error seeking:', error)
      res.status(500).json({ error: 'Failed to seek' })
    }
  }

  /**
   * POST /api/sonos/room/:roomName/next
   * @private
   */
  async _next(req, res) {
    try {
      const success = await this.sonos.next(req.params.roomName)
      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error skipping:', error)
      res.status(500).json({ error: 'Failed to skip' })
    }
  }

  /**
   * POST /api/sonos/room/:roomName/previous
   * @private
   */
  async _previous(req, res) {
    try {
      const success = await this.sonos.previous(req.params.roomName)
      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error going to previous:', error)
      res.status(500).json({ error: 'Failed to go to previous' })
    }
  }

  // ============================================
  // Grouping Routes
  // ============================================

  /**
   * POST /api/sonos/room/:roomName/join/:targetRoom
   * @private
   */
  async _joinRoom(req, res) {
    try {
      const { roomName, targetRoom } = req.params
      const success = await this.sonos.joinRoom(roomName, targetRoom)
      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error joining room:', error)
      res.status(500).json({ error: 'Failed to join room' })
    }
  }

  /**
   * POST /api/sonos/room/:roomName/add/:roomToAdd
   * @private
   */
  async _addToGroup(req, res) {
    try {
      const { roomName, roomToAdd } = req.params
      const success = await this.sonos.addToGroup(roomName, roomToAdd)
      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error adding to group:', error)
      res.status(500).json({ error: 'Failed to add to group' })
    }
  }

  /**
   * POST /api/sonos/room/:roomName/leave
   * @private
   */
  async _leaveGroup(req, res) {
    try {
      const success = await this.sonos.leaveGroup(req.params.roomName)
      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error leaving group:', error)
      res.status(500).json({ error: 'Failed to leave group' })
    }
  }

  /**
   * POST /api/sonos/room/:roomName/group
   * Body: { rooms: string[] }
   * @private
   */
  async _createGroup(req, res) {
    try {
      const { rooms } = req.body
      if (!Array.isArray(rooms)) {
        return res.status(400).json({ error: 'rooms must be an array' })
      }
      const success = await this.sonos.createGroup(req.params.roomName, rooms)
      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error creating group:', error)
      res.status(500).json({ error: 'Failed to create group' })
    }
  }

  /**
   * POST /api/sonos/room/:roomName/ungroup
   * @private
   */
  async _disbandGroup(req, res) {
    try {
      const success = await this.sonos.disbandGroup(req.params.roomName)
      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error disbanding group:', error)
      res.status(500).json({ error: 'Failed to disband group' })
    }
  }
}

module.exports = SonosRouter

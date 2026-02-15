'use strict'

const Path = require('path')
const express = require('express')
const Logger = require('../Logger')
const Database = require('../Database')
const DeviceInfo = require('../objects/DeviceInfo')

// Sonos timing values are now configurable via Database.serverSettings
// See: sonosSeekInitialDelayMs, sonosSeekRetryDelayMs, sonosPositionToleranceSeconds,
//      sonosGroupFormationDelayMs, sonosMaxSeekAttempts, sonosPostSeekResumeDelayMs

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
    /** @type {Map<string, {sessionId: string, trackStartOffset: number, userId: string}>} */
    this.roomSessions = new Map()

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
    this.router.post('/room/:roomName/stop', this._stop.bind(this))
    this.router.post('/room/:roomName/sync', this._syncProgress.bind(this))
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
        supportsGrouping: this.sonos?.supportsGrouping?.() || false,
        defaultRoom: Database.serverSettings?.sonosDefaultRoom || null,
        defaultGroup: Database.serverSettings?.sonosDefaultGroup || []
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

      const rooms = await this.sonos.getDevices()
      Logger.debug(`[SonosRouter] getDevices returned ${rooms?.length || 0} rooms`)
      res.json({ rooms, zones: rooms }) // Both for compatibility
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

      Logger.info(`[SonosRouter] _playItem called: room=${roomName}, libraryItemId=${libraryItemId}, episodeId=${episodeId}, startTime=${startTime} (type: ${typeof startTime})`)

      // Validation
      if (!libraryItemId) {
        return res.status(400).json({ error: 'libraryItemId is required' })
      }

      const libraryItem = await Database.libraryItemModel.getExpandedById(libraryItemId)
      if (!libraryItem) {
        return res.status(404).json({ error: 'Library item not found' })
      }

      // Check if there's already a session for this room playing the same item
      const existingRoomSession = this.roomSessions.get(roomName)
      let session = null
      let reusingSession = false

      if (existingRoomSession) {
        session = this.playbackSessionManager.getSession(existingRoomSession.sessionId)
        if (session && session.libraryItemId === libraryItemId && session.episodeId === (episodeId || null)) {
          // Reuse existing session for same item
          Logger.info(`[SonosRouter] Reusing existing session ${session.id} for room ${roomName}`)
          reusingSession = true
        } else {
          // Different item - remove old session entry
          Logger.info(`[SonosRouter] Different item - creating new session (was: ${session?.libraryItemId}, now: ${libraryItemId})`)
          this.roomSessions.delete(roomName)
          session = null
        }
      }

      if (!session) {
        // Create or get Sonos device from database
        const deviceId = `sonos-${roomName}`
        let deviceInfo = await Database.deviceModel.getOldDeviceByDeviceId(deviceId)

        if (!deviceInfo) {
          // Create new device - don't set id, let DB auto-generate UUID
          const newDeviceInfo = new DeviceInfo({
            userId: req.user.id,
            deviceId: deviceId,
            deviceType: 'sonos-speaker',
            clientName: 'Sonos',
            clientVersion: '1.0',
            manufacturer: 'Sonos',
            model: roomName,
            deviceName: `Sonos: ${roomName}`
          })

          await Database.deviceModel.createFromOld(newDeviceInfo)
          // Fetch back the created device to get the auto-generated id
          deviceInfo = await Database.deviceModel.getOldDeviceByDeviceId(deviceId)
          Logger.info(`[SonosRouter] Created new device: ${deviceId}, id: ${deviceInfo?.id}`)
        } else if (!deviceInfo.clientVersion) {
          // Update existing device if clientVersion is missing
          deviceInfo.clientVersion = '1.0'
          await Database.deviceModel.update({ clientVersion: '1.0' }, { where: { id: deviceInfo.id } })
          Logger.info(`[SonosRouter] Updated device ${deviceId} with clientVersion`)
        }

        if (!deviceInfo) {
          return res.status(500).json({ error: 'Failed to create or get device info' })
        }

        session = await this.playbackSessionManager.startSession(req.user, deviceInfo, libraryItem, episodeId, { forceDirectPlay: true, mediaPlayer: 'sonos' })

        if (!session) {
          return res.status(500).json({ error: 'Failed to create playback session' })
        }
      }

      if (!session.audioTracks?.length) {
        return res.status(500).json({ error: 'No audio tracks available' })
      }

      // Calculate seek position first - prefer explicit startTime from request, fallback to session's saved position
      const requestStartTime = typeof startTime === 'number' ? startTime : parseFloat(startTime)
      const totalSeekPosition = !isNaN(requestStartTime) ? requestStartTime : session.startTime

      Logger.info(`[SonosRouter] Seek calculation: requestStartTime=${requestStartTime}, session.startTime=${session.startTime}, totalSeekPosition=${totalSeekPosition}`)

      // Build streaming URL - selects correct track for multi-track audiobooks
      const { url: streamUrl, trackSeekOffset, trackStartOffset, trackDuration } = this._buildStreamUrl(req, session, totalSeekPosition)

      Logger.info(`[SonosRouter] Stream URL: ${streamUrl}, trackSeekOffset: ${trackSeekOffset}s, trackStartOffset: ${trackStartOffset}s`)

      // Auto-group if configured
      await this._autoGroupIfConfigured(roomName)

      // Play on Sonos - if seeking needed, pause immediately then seek then resume
      const needsSeek = trackSeekOffset && trackSeekOffset > 0
      const success = await this.sonos.playUrl(roomName, streamUrl)

      if (success) {
        Logger.info(`[SonosRouter] Started playback on ${roomName}`)

        if (needsSeek) {
          // Pause immediately to prevent audio playing from beginning
          await this.sonos.pause(roomName)
          Logger.info(`[SonosRouter] Paused for seek to ${trackSeekOffset}s`)

          // Wait for stream to load, then seek and resume
          const performSeekAndResume = async (attempt = 1) => {
            try {
              const seekResult = await this.sonos.seek(roomName, trackSeekOffset)
              Logger.info(`[SonosRouter] Seek attempt ${attempt}: seeked to ${trackSeekOffset}s, result=${seekResult}`)

              // Small delay to let seek complete, then resume
              await new Promise((resolve) => setTimeout(resolve, Database.serverSettings.sonosPostSeekResumeDelayMs))
              await this.sonos.play(roomName)
              Logger.info(`[SonosRouter] Resumed playback after seek`)

              // Verify position
              setTimeout(async () => {
                try {
                  const state = await this.sonos.getDeviceState(roomName)
                  const currentPos = state?.elapsedTime || state?.trackPosition || 0
                  Logger.info(`[SonosRouter] Position check: currentPosition=${currentPos}, expected=${trackSeekOffset}`)
                  if (currentPos < trackSeekOffset - Database.serverSettings.sonosPositionToleranceSeconds && attempt < Database.serverSettings.sonosMaxSeekAttempts) {
                    Logger.warn(`[SonosRouter] Position mismatch - retrying`)
                    await this.sonos.pause(roomName)
                    performSeekAndResume(attempt + 1)
                  }
                } catch (e) {
                  Logger.debug(`[SonosRouter] Position check failed: ${e.message}`)
                }
              }, Database.serverSettings.sonosSeekRetryDelayMs)
            } catch (seekError) {
              Logger.error(`[SonosRouter] Seek attempt ${attempt} failed: ${seekError.message}`)
              if (attempt < Database.serverSettings.sonosMaxSeekAttempts) {
                setTimeout(() => performSeekAndResume(attempt + 1), Database.serverSettings.sonosSeekRetryDelayMs)
              } else {
                // Give up on seeking, just resume playback from beginning
                await this.sonos.play(roomName)
                Logger.warn(`[SonosRouter] Seek failed after ${Database.serverSettings.sonosMaxSeekAttempts} attempts, resuming from current position`)
              }
            }
          }

          // Start seek after initial delay to let stream load
          setTimeout(() => performSeekAndResume(1), Database.serverSettings.sonosSeekInitialDelayMs)
        } else {
          Logger.info(`[SonosRouter] No seek needed (trackSeekOffset=${trackSeekOffset})`)
        }

        // Track which session is playing on this room
        this.roomSessions.set(roomName, {
          sessionId: session.id,
          trackStartOffset,
          userId: req.user.id
        })

        res.json({
          success: true,
          sessionId: session.id,
          streamUrl,
          trackCount: session.audioTracks.length,
          trackStartOffset,
          trackDuration,
          displayTitle: session.displayTitle
        })
      } else {
        Logger.error(`[SonosRouter] Playback failed for: ${streamUrl}`)
        // Clean up orphaned session
        this.playbackSessionManager.removeSession(session.id)
        res.status(500).json({
          error: 'Failed to play on Sonos — check sonosServerUrl setting',
          streamUrl,
          hint: "Set sonosServerUrl to your server's LAN IP (e.g., http://192.168.1.x:13378)"
        })
      }
    } catch (error) {
      Logger.error('[SonosRouter] Error playing item:', error)
      res.status(500).json({ error: 'Failed to play item on Sonos' })
    }
  }

  /**
   * Build the streaming URL for Sonos, selecting correct track for seek position
   * @param {express.Request} req
   * @param {Object} session - Playback session
   * @param {number} [seekPosition] - Desired playback position in seconds
   * @returns {{url: string, trackSeekOffset: number, isDirectUrl: boolean}}
   * @private
   */
  _buildStreamUrl(req, session, seekPosition = 0) {
    const basePath = global.RouterBasePath || ''

    // Prefer configured sonosServerUrl
    let baseUrl = this.sonos.serverUrl
    if (!baseUrl) {
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
      const host = req.headers['x-forwarded-host'] || req.headers.host
      baseUrl = `${protocol}://${host}`
      Logger.warn('[SonosRouter] No sonosServerUrl configured, using request host')
    }

    // For multi-track audiobooks, find the track containing the seek position
    let targetTrack = session.audioTracks[0]
    let trackSeekOffset = seekPosition

    // Single-track boundary check: clamp seek to track duration
    if (session.audioTracks.length === 1 && targetTrack.duration > 0) {
      trackSeekOffset = Math.min(seekPosition, targetTrack.duration - 1)
    } else if (seekPosition > 0 && session.audioTracks.length > 1) {
      let cumulativeTime = 0
      let foundTrack = false
      for (const track of session.audioTracks) {
        if (cumulativeTime + track.duration > seekPosition) {
          targetTrack = track
          trackSeekOffset = seekPosition - cumulativeTime
          foundTrack = true
          Logger.info(`[SonosRouter] Multi-track: position ${seekPosition}s is in track ${track.index} (offset ${trackSeekOffset}s, track duration ${track.duration}s)`)
          break
        }
        cumulativeTime += track.duration
      }
      // If position is beyond all tracks, use last track
      if (!foundTrack) {
        targetTrack = session.audioTracks[session.audioTracks.length - 1]
        trackSeekOffset = targetTrack.duration - 1 // Near end of last track
        Logger.warn(`[SonosRouter] Position ${seekPosition}s beyond total duration (${cumulativeTime}s), using end of last track`)
      }
    }

    const trackIndex = targetTrack.index ?? 1
    const trackStartOffset = targetTrack.startOffset || 0
    const trackDuration = targetTrack.duration || 0

    // For URL-only episodes, use the direct enclosure URL
    if (targetTrack.isDirectUrl && targetTrack.contentUrl) {
      Logger.info(`[SonosRouter] Using direct URL for playback: ${targetTrack.contentUrl}`)
      return {
        url: targetTrack.contentUrl,
        trackSeekOffset,
        trackStartOffset,
        trackDuration,
        isDirectUrl: true
      }
    }

    // Sonos requires file extension for content-type detection
    const fileExt = targetTrack.metadata?.path ? Path.extname(targetTrack.metadata.path) : '.mp3'

    return {
      url: `${baseUrl}${basePath}/public/session/${session.id}/track/${trackIndex}${fileExt}`,
      trackSeekOffset,
      trackStartOffset,
      trackDuration,
      isDirectUrl: false
    }
  }

  /**
   * Auto-group speakers if configured in settings
   * @param {string} roomName - Coordinator room
   * @private
   */
  async _autoGroupIfConfigured(roomName) {
    const defaultGroup = Database.serverSettings?.sonosDefaultGroup || []
    Logger.debug(`[SonosRouter] _autoGroupIfConfigured: roomName=${roomName}, defaultGroup=${JSON.stringify(defaultGroup)}, length=${defaultGroup.length}`)
    if (defaultGroup.length > 0) {
      Logger.info(`[SonosRouter] Auto-grouping: ${roomName} + ${defaultGroup.join(', ')}`)
      await this.sonos.createGroup(roomName, defaultGroup)
      await new Promise((resolve) => setTimeout(resolve, Database.serverSettings.sonosGroupFormationDelayMs))
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
   * Pauses playback and syncs progress
   * @private
   */
  async _pause(req, res) {
    try {
      const { roomName } = req.params

      // Sync progress before pausing
      await this._syncRoomProgress(roomName, req.user)

      const success = await this.sonos.pause(roomName)
      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error pausing:', error)
      res.status(500).json({ error: 'Failed to pause' })
    }
  }

  /**
   * POST /api/sonos/room/:roomName/stop
   * Stops playback, syncs progress, and closes the session
   * @private
   */
  async _stop(req, res) {
    try {
      const { roomName } = req.params

      // Sync progress before stopping
      await this._syncRoomProgress(roomName, req.user)

      // Stop playback
      const success = await this.sonos.stop(roomName)

      // Close the session
      const roomSession = this.roomSessions.get(roomName)
      if (roomSession) {
        const session = this.playbackSessionManager.getSession(roomSession.sessionId)
        if (session) {
          await this.playbackSessionManager.closeSession(req.user, session, null)
          Logger.info(`[SonosRouter] Closed session ${roomSession.sessionId} for room ${roomName}`)
        }
        this.roomSessions.delete(roomName)
      }

      res.json({ success })
    } catch (error) {
      Logger.error('[SonosRouter] Error stopping:', error)
      res.status(500).json({ error: 'Failed to stop' })
    }
  }

  /**
   * POST /api/sonos/room/:roomName/sync
   * Syncs current Sonos playback position to the session
   * @private
   */
  async _syncProgress(req, res) {
    try {
      const { roomName } = req.params
      const result = await this._syncRoomProgress(roomName, req.user)

      if (!result) {
        return res.status(404).json({ error: 'No active session for this room' })
      }

      res.json(result)
    } catch (error) {
      Logger.error('[SonosRouter] Error syncing progress:', error)
      res.status(500).json({ error: 'Failed to sync progress' })
    }
  }

  /**
   * Sync progress for a room's active session
   * @param {string} roomName
   * @param {import('../models/User')} user
   * @returns {Promise<{currentTime: number, synced: boolean}|null>}
   * @private
   */
  async _syncRoomProgress(roomName, user) {
    const roomSession = this.roomSessions.get(roomName)
    if (!roomSession) {
      Logger.debug(`[SonosRouter] No active session for room ${roomName}`)
      return null
    }

    const session = this.playbackSessionManager.getSession(roomSession.sessionId)
    if (!session) {
      Logger.warn(`[SonosRouter] Session ${roomSession.sessionId} not found, removing from room map`)
      this.roomSessions.delete(roomName)
      return null
    }

    try {
      // Get current position from Sonos
      const state = await this.sonos.getDeviceState(roomName)
      if (!state) {
        Logger.warn(`[SonosRouter] Could not get state for room ${roomName}`)
        return null
      }

      // Calculate total position: track offset + current position in track
      const elapsedTime = state.elapsedTime || state.trackPosition || 0
      const totalCurrentTime = (roomSession.trackStartOffset || 0) + elapsedTime

      Logger.info(`[SonosRouter] Syncing progress for ${roomName}: elapsedTime=${elapsedTime}, trackStartOffset=${roomSession.trackStartOffset}, totalCurrentTime=${totalCurrentTime}`)

      // Sync to session
      const syncData = {
        currentTime: totalCurrentTime,
        timeListened: 0 // We don't track exact listening time for Sonos
      }

      const syncSuccess = await this.playbackSessionManager.syncSession(user, session, syncData)

      return {
        currentTime: totalCurrentTime,
        elapsedTime,
        trackStartOffset: roomSession.trackStartOffset,
        synced: syncSuccess
      }
    } catch (error) {
      Logger.error(`[SonosRouter] Error syncing room progress: ${error.message}`)
      return null
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
      const roomName = req.params.roomName
      if (position === undefined || position < 0) {
        return res.status(400).json({ error: 'Position must be a positive number' })
      }

      const seekSuccess = await this.sonos.seek(roomName, position)
      if (!seekSuccess) {
        return res.json({ success: false, error: 'Seek command failed' })
      }

      // Verify the seek actually worked by checking position
      await new Promise((resolve) => setTimeout(resolve, Database.serverSettings.sonosPostSeekResumeDelayMs))
      const state = await this.sonos.getDeviceState(roomName)
      if (state && state.elapsedTime !== undefined) {
        const actualPosition = state.elapsedTime
        const diff = Math.abs(actualPosition - position)
        if (diff <= Database.serverSettings.sonosPositionToleranceSeconds) {
          Logger.debug(`[SonosRouter] Seek verified: requested=${position}s, actual=${actualPosition}s`)
          return res.json({ success: true, actualPosition })
        } else {
          Logger.warn(`[SonosRouter] Seek position mismatch: requested=${position}s, actual=${actualPosition}s, diff=${diff}s`)
          return res.json({ success: false, error: 'Position mismatch', requestedPosition: position, actualPosition })
        }
      }

      // Couldn't verify but seek command succeeded
      res.json({ success: true, verified: false })
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

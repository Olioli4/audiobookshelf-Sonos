/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.27.0'
const migrationName = `${migrationVersion}-podcast-episode-audio-source-type`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds the audioSourceType column to the podcastEpisodes table.
 * This allows episodes to be added as URL references without downloading.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('podcastEpisodes')) {
    const tableDescription = await queryInterface.describeTable('podcastEpisodes')
    if (!tableDescription.audioSourceType) {
      logger.info(`${loggerPrefix} Adding audioSourceType column to podcastEpisodes table`)
      await queryInterface.addColumn('podcastEpisodes', 'audioSourceType', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        defaultValue: 'local',
        allowNull: true
      })
      logger.info(`${loggerPrefix} Added audioSourceType column to podcastEpisodes table`)
    } else {
      logger.info(`${loggerPrefix} audioSourceType column already exists in podcastEpisodes table`)
    }
  } else {
    logger.info(`${loggerPrefix} podcastEpisodes table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the audioSourceType column from the podcastEpisodes table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('podcastEpisodes')) {
    const tableDescription = await queryInterface.describeTable('podcastEpisodes')
    if (tableDescription.audioSourceType) {
      logger.info(`${loggerPrefix} Removing audioSourceType column from podcastEpisodes table`)
      await queryInterface.removeColumn('podcastEpisodes', 'audioSourceType')
      logger.info(`${loggerPrefix} Removed audioSourceType column from podcastEpisodes table`)
    } else {
      logger.info(`${loggerPrefix} audioSourceType column does not exist in podcastEpisodes table`)
    }
  } else {
    logger.info(`${loggerPrefix} podcastEpisodes table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }

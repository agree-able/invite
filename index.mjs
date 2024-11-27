import { z, Caller } from '@agree-able/rpc'
import agreement, { NewRoom, RoomExpectiations, Expectations, NewRoomResponse } from './agreement.mjs'
import { breakoutRoomKey, didKey } from './dnsTxt.mjs'
import { signWhoami, verifyWhoamiSignature, generateChallengeText, getKeybaseProofChain } from './keybaseVerification.mjs'

/**
 * Loads room configuration based on provided config options
 * @param {Object} config - Configuration object
 * @param {string} [config.invite] - Direct invite string
 * @param {string} [config.domain] - Domain to lookup breakout room key from
 * @param {boolean} [config.loadDid] - Whether to load DID from domain
 * @param {string} [config.whoamiHost] - Host for whoami verification
 * @param {string} [config.keybaseUsername] - Keybase username for verification
 * @param {string} [config.privateKeyArmored] - PGP private key in armored format
 * @param {string[]} [config._] - Array of command line arguments
 * @param {Function} confirmEnterRoom - Callback function to confirm room entry
 * @returns {Promise<{invite?: string, did?: string}>} Room configuration
 */
export const load = async (config, confirmEnterRoom) => {
  if (config.invite) return { invite: config.invite }
  if (config.domain) {
    const agreeableKey = await breakoutRoomKey(config.domain)
    const did = config.loadDid ? await didKey(config.domain) : null
    if (agreeableKey) {
      const { ok, invite, reason} = await withAgreeableKey(config, agreeableKey, confirmEnterRoom)
      if (!ok) throw new Error(reason)
      return { invite, did }
    }
  }
  // lastly if one string on the cli, lets assume that is the invite
  if (config._ && config._.length === 1) return config._[0]
}

export const withAgreeableKey = async (config, agreeableKey, confirmEnterRoom) => {
  const { roomExpectations, newRoom } = await roomProxyFromKey(agreeableKey)
  const expectationOpts = {}
  if (config.whoamiHost) expectationOpts.challengeText = await generateChallengeText()
  /** @type{z.infer<Expectations>} */
  const expectations = await roomExpectations(expectationOpts)
  const confirmEnterRoomExtra = {}
  if (config.whoamiHost && expectations.whoami && expectations.whoami.keybase) {
    confirmEnterRoomExtra.whoami = { keybase: {} }
    confirmEnterRoomExtra.whoami.keybase.verfied = await verifyWhoamiSignature(expectations.whoami.keybase.challengeResponse, expectations.whoami.keybase.username)
    confirmEnterRoomExtra.whoami.keybase.chain = await getKeybaseProofChain(expectations.whoami.keybase.username)
  }
  if (!confirmEnterRoom) throw new Error('confirmEnterRoom function required')
  const accept = await confirmEnterRoom(expectations, confirmEnterRoom)
  const newRoomOpts = { accept }
  if (expectations.whoamiRequired) {
    newRoomOpts.whoami = {}
    if (!config.keybaseUsername) throw new Error('keybaseUsername required in config')
    if (!config.privateKeyArmored) throw new Error('pgp privateKeyArmored required in config')
    if (!expectations.challengeText) throw new Error('challengeText required in expectations')
    newRoomOpts.whoami.keybase = {
      username: config.keybaseUsername,
      challengeResponse: await signWhoami(expectations.challengeText, config.privateKeyArmored)
  }
  /** @type{z.infer<NewRoomResponse>} */
  const response = await newRoom(newRoomOpts)
  return response 
}

export const roomProxyFromKey = async (agreeableKey) => {
  const caller = new Caller(agreeableKey)
  // @ts-expect-error
  /** @type{{ 
   *   newRoom: z.infer<NewRoom> 
   *   RoomExpectiations: z.infer<RoomExpectiations>
   * }} */
  const { newRoom, roomExpectations } = caller.proxy(agreement)
  return { newRoom, roomExpectations }
}



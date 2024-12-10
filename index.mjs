import { z, Caller } from '@agree-able/rpc'
import agreement, { Expectations, AcceptExpectations } from './agreement.mjs'
import { breakoutRoomKey, didKey } from './dnsTxt.mjs'
import { signText, verifySignedText, generateChallengeText, getKeybaseProofChain } from './keybaseVerification.mjs'
import fs from 'fs'
import path from 'path'
import os from 'os'
export { signText, verifySignedText, generateChallengeText, getKeybaseProofChain }

export const ConfigSchema = z.object({
  invite: z.string().describe('Directly set invite - a z32 string').optional(),
  agreeableKey: z.string().describe('Key to lookup breakout room key from').optional(),
  domain: z.string().describe('Domain to lookup breakout room key from').optional(),
  loadDid: z.boolean().describe('Whether to load DID from domain').optional(),
  hostProveWhoami: z.boolean().describe('Should the Host prove whoami verification').optional(),
  keybaseUsername: z.string().describe('Keybase username for verification').optional(),
  privateKeyArmoredFile: z.string().describe('File location of a PGP private key in armored format').optional(),
  privateKeyArmored: z.string().describe('PGP private key in armored format').optional(),
  signMessages: z.boolean().describe('Sign each message with PGP key').optional(),
  _: z.array(z.string()).describe('Array of command line arguments').optional()
})

const ChainItem = z.object({
  username: z.string().describe('username associated with the proof'),
  serviceUrl: z.string().describe('URL of the service where the proof is hosted'),
  proofUrl: z.string().describe('Direct URL to the proof'),
  presentedUrl: z.string().optional().describe('User-friendly URL for displaying the proof').optional(),
  state: z.number().describe('Whether the proof is currently valid')
})

export const HostDetails = z.object({
  did: z.string().optional().describe('DID of the host'),
  whoami: z.object({
    keybase: z.object({
      username: z.string().describe('username on keybase'),
      verified: z.boolean().describe('if the verification passed'),
      chain: z.object({
        dns: z.array(ChainItem)
      }).passthrough()
    }).optional().describe('if hostProveWhoami is true, then this should be provided')
  }).optional().describe('host whoami')
})

export const ConfirmEnterRoomSchema = z.function().args(
  Expectations,
  HostDetails
).returns(z.promise(AcceptExpectations))

/**
 * Loads room configuration based on provided config options
 * @param {Object} config - Configuration object
 * @param {string} [config.invite] - invite is directly set, no lookup - a z32 string
* @param {string} [config.agreeableKey] - Key to lookup breakout room key from
 * @param {string} [config.domain] - Domain to lookup breakout room key from
 * @param {boolean} [config.loadDid] - Whether to load DID from domain
 * @param {boolean} [config.hostProveWhoami] - should the Host perform whoami verification
 * @param {string} [config.keybaseUsername] - Keybase username for verification
 * @param {string} [config.privateKeyArmoredFile] - File location of a PGP private key in armored format
 * @param {string} [config.privateKeyArmored] - PGP private key in armored format
 * @param {boolean} [config.signMessages] - Sign each message with PGP key
 * @param {string[]} [config._] - Array of command line arguments
 * @param {Function} confirmEnterRoom - Callback function to confirm room entry
 * @returns {Promise<{invite?: string }>} Room configuration
 */
export const handleInvite = async (config, confirmEnterRoom) => {
  // validate config using zod
  ConfigSchema.parse(config)
  // validate confirmEnterRoom using zod
  ConfirmEnterRoomSchema.parse(confirmEnterRoom)
  if (config.invite) return { invite: config.invite }
  if (config.agreeableKey) return await withAgreeableKey(config, confirmEnterRoom, config.agreeableKey, {})
  if (config.domain) {
    const agreeableKey = await breakoutRoomKey(config.domain)
    const extraInfo = {}
    const did = config.loadDid ? await didKey(config.domain) : null
    if (did) extraInfo.did = did
    if (agreeableKey) {
      const { ok, invite, reason } = await withAgreeableKey(config, confirmEnterRoom, agreeableKey, extraInfo)
      if (!ok) throw new Error(reason)
      return { invite }
    }
  }
  // lastly if one string on the cli, lets assume that is the invite
  if (config._ && config._.length === 1) return { invite: config._[0] }
  return {}
}

export const withAgreeableKey = async (config, confirmEnterRoom, agreeableKey, hostExtraInfo) => {
  const proxy = await roomProxyFromKey(agreeableKey)
  const keybase = { verifySignedText, signText, getKeybaseProofChain }
  return await withExternal(config, confirmEnterRoom, proxy, keybase, hostExtraInfo)
}

export const withExternal = async (config, confirmEnterRoom, { roomExpectations, newRoom }, keybase, hostExtraInfo) => {
  const expectationOpts = {}
  if (config.hostProveWhoami) expectationOpts.challengeText = await generateChallengeText()
  /** @type{z.infer<Expectations>} */
  const expectations = await roomExpectations(expectationOpts)
  const hostDetails = { ...hostExtraInfo }
  if (config.hostProveWhoami) {
    if (!expectations.whoami) throw new Error('host was to prove whoami but expectations.whoami was not returned')
    if (expectations.whoami.keybase) {
      if (!expectations.whoami.keybase.username) throw new Error('host username was not returned')
      if (expectationOpts.challengeText !== expectations.whoami.keybase.challengeResponse.text) throw new Error('challengeText was modified')
      hostDetails.whoami = { keybase: { username: expectations.whoami.keybase.username } }
      hostDetails.whoami.keybase.verified = await keybase.verifySignedText(expectations.whoami.keybase.challengeResponse, expectations.whoami.keybase.username)
      hostDetails.whoami.keybase.chain = await keybase.getKeybaseProofChain(expectations.whoami.keybase.username)
    }
    if (!hostDetails.whoami) throw new Error('host did not provide any known whoami response')
  }
  const wrapped = ConfirmEnterRoomSchema.implement(confirmEnterRoom)
  // console.log('calling the confirmEnterRoom function', JSON.stringify(expectations, null, 4), JSON.stringify(hostDetails, null, 4))
  const accept = await wrapped(expectations, hostDetails)
  AcceptExpectations.parse(accept)

  const newRoomOpts = { accept }
  if (expectations.whoamiRequired) {
    newRoomOpts.whoami = {}
    if (!config.keybaseUsername) throw new Error('keybaseUsername required in config')
    if (!config.privateKeyArmored && !config.privateKeyArmoredFile) throw new Error('pgp privateKeyArmored required in config')
    if (!expectations.challengeText) throw new Error('challengeText required in expectations')
    let privateKeyArmored = config.privateKeyArmored
    if (config.privateKeyArmoredFile) {
      privateKeyArmored = fs.readFileSync(resolvePath(config.privateKeyArmoredFile), 'utf8')
    }
    newRoomOpts.whoami.keybase = {
      username: config.keybaseUsername,
      challengeResponse: await keybase.signText(expectations.challengeText, privateKeyArmored)
    }
  }
  /** @type{z.infer<NewRoomResponse>} */
  const response = await newRoom(newRoomOpts)
  return response
}

export const roomProxyFromKey = async (agreeableKey) => {
  const caller = new Caller(agreeableKey)
  // @ts-expect-error
  /** @type{{
   *   newRoom: z.infer<import('./agreement.mjs').NewRoom>
   *   RoomExpectiations: z.infer<import('./agreement.mjs').RoomExpectiations>
   * }} */
  const { newRoom, roomExpectations } = caller.proxy(agreement)
  return { newRoom, roomExpectations }
}

// Function to resolve a path with ~
function resolvePath (inputPath) {
  if (inputPath.startsWith('~')) {
    return path.join(os.homedir(), inputPath.slice(1))
  }
  return path.resolve(inputPath)
}

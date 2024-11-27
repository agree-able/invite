import { z, Caller } from '@agree-able/rpc'
import agreement, { Expectations, AcceptExpectations } from './agreement.mjs'
import { breakoutRoomKey, didKey } from './dnsTxt.mjs'
import { signWhoami, verifyWhoamiSignature, generateChallengeText, getKeybaseProofChain } from './keybaseVerification.mjs'
import fs from 'fs'

export const ConfigSchema = z.object({
  invite: z.string().describe('Directly set invite - a z32 string').optional(),
  domain: z.string().describe('Domain to lookup breakout room key from').optional(),
  loadDid: z.boolean().describe('Whether to load DID from domain').optional(),
  hostProveWhoami: z.boolean().describe('Should the Host prove whoami verification').optional(),
  keybaseUsername: z.string().describe('Keybase username for verification').optional(),
  privateKeyArmoredFile: z.string().describe('File location of a PGP private key in armored format').optional(),
  privateKeyArmored: z.string().describe('PGP private key in armored format').optional(),
  _: z.array(z.string()).describe('Array of command line arguments').optional()
})

export const ConfirmEnterRoomSchema = z.function().args(
  Expectations,
  z.object({
    whoami: z.object({
      keybase: z.object({
        username: z.string().describe('username on keybase'),
        verified: z.boolean().describe('if the verification passed'),
        chain: z.array(z.object({
          username: z.string().describe('username associated with the proof'),
          serviceUrl: z.string().describe('URL of the service where the proof is hosted'),
          proofUrl: z.string().describe('Direct URL to the proof'),
          presentedUrl: z.string().describe('User-friendly URL for displaying the proof').optional(),
          state: z.number().describe('Whether the proof is currently valid')
        })).describe('keybase information about the host')
      }).optional().describe('if hostProveWhoami is true, then this should be provided')
    }).optional().describe('host details that might be useful')
  })
).returns(z.promise(AcceptExpectations))

/**
 * Loads room configuration based on provided config options
 * @param {Object} config - Configuration object
 * @param {string} [config.invite] - invite is directly set, no lookup - a z32 string
 * @param {string} [config.domain] - Domain to lookup breakout room key from
 * @param {boolean} [config.loadDid] - Whether to load DID from domain
 * @param {boolean} [config.hostProveWhoami] - should the Host perform whoami verification
 * @param {string} [config.keybaseUsername] - Keybase username for verification
 * @param {string} [config.privateKeyArmoredFile] - File location of a PGP private key in armored format
 * @param {string} [config.privateKeyArmored] - PGP private key in armored format
 * @param {string[]} [config._] - Array of command line arguments
 * @param {Function} confirmEnterRoom - Callback function to confirm room entry
 * @returns {Promise<{invite?: string, did?: string}>} Room configuration
 */
export const load = async (config, confirmEnterRoom) => {
  // validate config using zod
  ConfigSchema.parse(config)
  // validate confirmEnterRoom using zod
  ConfirmEnterRoomSchema.parse(confirmEnterRoom)
  if (config.invite) return { invite: config.invite }
  if (config.domain) {
    const agreeableKey = await breakoutRoomKey(config.domain)
    const did = config.loadDid ? await didKey(config.domain) : null
    if (agreeableKey) {
      const { ok, invite, reason } = await withAgreeableKey(config, confirmEnterRoom, agreeableKey)
      if (!ok) throw new Error(reason)
      return { invite, did }
    }
  }
  // lastly if one string on the cli, lets assume that is the invite
  if (config._ && config._.length === 1) return { invite: config._[0] }
}

export const withAgreeableKey = async (config, confirmEnterRoom, agreeableKey) => {
  const proxy = await roomProxyFromKey(agreeableKey)
  const keybase = { verifyWhoamiSignature, getKeybaseProofChain }
  return await withExternal(config, confirmEnterRoom, proxy, keybase)
}

export const withExternal = async (config, confirmEnterRoom, { roomExpectations, newRoom }, keybase) => {
  const expectationOpts = {}
  if (config.hostProveWhoami) expectationOpts.challengeText = await generateChallengeText()
  /** @type{z.infer<Expectations>} */
  const expectations = await roomExpectations(expectationOpts)
  if (config.hostProveWhoami && !expectations.whoami) throw new Error('host was to prove whoami but expectations.whoami was not returned')
  const hostDetails = {}
  if (config.hostProveWhoami && expectations.whoami && expectations.whoami.keybase) {
    hostDetails.whoami = { keybase: { username: expectations.whoami.keybase.username } }
    hostDetails.whoami.keybase.verfied = await keybase.verifyWhoamiSignature(expectations.whoami.keybase.challengeResponse, expectations.whoami.keybase.username)
    hostDetails.whoami.keybase.chain = await keybase.getKeybaseProofChain(expectations.whoami.keybase.username)
  }
  if (!confirmEnterRoom) throw new Error('confirmEnterRoom function required')
  const accept = await confirmEnterRoom(expectations, hostDetails)
  const newRoomOpts = { accept }
  if (expectations.whoamiRequired) {
    newRoomOpts.whoami = {}
    if (!config.keybaseUsername) throw new Error('keybaseUsername required in config')
    if (!config.privateKeyArmored && !config.privateKeyArmoredFile) throw new Error('pgp privateKeyArmored required in config')
    if (!expectations.challengeText) throw new Error('challengeText required in expectations')
    const privateKeyArmored = config.privateKeyArmored
    if (config.privateKeyArmoredFile) {
      config.privateKeyArmored = await fs.promises.readFile(config.privateKeyArmoredFile, 'utf8')
    }
    newRoomOpts.whoami.keybase = {
      username: config.keybaseUsername,
      challengeResponse: await signWhoami(expectations.challengeText, privateKeyArmored)
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
   *   newRoom: z.infer<NewRoom>
   *   RoomExpectiations: z.infer<RoomExpectiations>
   * }} */
  const { newRoom, roomExpectations } = caller.proxy(agreement)
  return { newRoom, roomExpectations }
}

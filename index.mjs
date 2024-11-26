import { z, Caller } from '@agree-able/rpc'
import agreement, { NewRoom, RoomExpectiations } from './agreement.mjs'
import { breakoutRoomKey, didKey, keybaseKey } from './dnsTxt.mjs'

export const load = async (config, confirmEnterRoom) => {
  if (config.invite) return { invite: config.invite }
  if (config.domain) {
    const agreeableKey = await breakoutRoomKey(config.domain)
    const did = config.loadDid ? await didKey(config.domain) : null
    const keybase = config.loadKeybase ? await keybaseKey(config.domain) : null
    if (agreeableKey) {
      const invite = await withAgreeableKey(agreeableKey, confirmEnterRoom)
      return { invite, did }
    }
  }
  // lastly if one string on the cli, lets assume that is the invite
  if (config._ && config._.length === 1) return config._[0]
}

export const withAgreeableKey = async (agreeableKey, confirmEnterRoom) => {
  const { newRoom, roomExpectations } = await roomProxyFromKey(agreeableKey)
  const expectations = await roomExpectations()
  if (confirmEnterRoom) {
    const {agreement, whoami} = await confirmEnterRoom(expectations)
    if (!agreement) return
  }
  const invite = await newRoom(agreement, whoami)
  return invite
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



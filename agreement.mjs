import { z, addRoute } from '@agree-able/contract'

export const KeybaseProof = z.object({
  username: z.string().describe('keybase username'),
  challengeResponse: z.object({
    payload: z.string().describe('the challenge text'),
    signature: z.string().describe('the signature of the challenge text')
  })
})

export const Whoami = z.object({
  // we will add more later?
  keybase: KeybaseProof.optional()
})

export const Expectations = z.object({
  reason: z.string().describe('give context to the participants, the reason for the room.'),
  rules: z.string().describe('rules for participants to follow for the room'),
  whoami: Whoami.optional().describe('The identity of the room host'),
  whoamiRequired: z.boolean().describe('if the participant needs to provide their identity'),
  challengeText: z.string().optional().describe('if whoamiRequired, a challenge text for the participant to sign')
})

export const RoomExpectiations = z.function().args({
  challengeText: z.string().optional().describe('the challenge text if you want the host to sign'),
}).returns(z.promise(Expectations))

export const AcceptExpectations = z.object({
  reason: z.boolean().describe('participant agrees to the reason for the room'),
  rules: z.boolean().describe('participant agrees to the rules for the room')
})

export const NewRoomResponse = z.object({
  ok: z.boolean().describe('if the invite was created. check the reason if false'),
  invite: z.string().describe('a z32 encoded room invite'),
  reason: z.string().optional().describe('if ok is false, the reason why')
})

export const NewRoom = z.function().args({
  accept: AcceptExpectations,
  whoami: Whoami.optional()
}).returns(z.promise(NewRoomResponse))

const api = {
  role: 'roommanager',
  version: '1.0.0',
  description: 'An interface for a host and participant to negotiate a room invitation',
  routes: {
    roomExpectations: addRoute(RoomExpectiations),
    newRoom: addRoute(NewRoom)
  }
}
export default api


import { z, addRoute } from '@agree-able/contract'

export const Expectations = z.object({
  reason: z.string().describe('give context to the participants, the reason for the room.'),
  rules: z.string().describe('rules for participants to follow for the room'),
  whoamiRequired: z.boolean().describe('if the participant needs to provide their identity')
})

export const AgreesToExpectations = z.object({
  reason: z.boolean().describe('participant agrees to the reason for the room'),
  rules: z.boolean().describe('participant agrees to the rules for the room')
})

export const RoomExpectiations = z.function().args().returns(z.promise(Expectations))
export const NewRoom = z.function().args({
  agreement: AgreesToExpectations
}).returns(z.promise(z.string().describe('a z32 encoded room invite')))
const api = {
  role: 'roommanager',
  version: '1.0.0',
  description: 'open a room',
  routes: {
    newRoom: addRoute(NewRoom),
    roomExpectations: addRoute(RoomExpectiations)
  }
}
export default api


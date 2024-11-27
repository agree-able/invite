import t from 'tap'
import { load } from '../index.mjs'

t.test('load where invite is on the config object', async t => {
  const config = { invite: 'aaaa' }
  const confirmEnterRoom = (_expectations, _extraInfo) => {}
  const { invite } = await load(config, confirmEnterRoom)
  t.ok(invite, 'invite')
  t.equal(invite, 'aaaa')
  t.end()
})

t.test('load where invite is on the first arg', async t => {
  const config = { _: ['aaaa'] }
  const confirmEnterRoom = (_expectations, _extraInfo) => {}
  const { invite } = await load(config, confirmEnterRoom)
  t.ok(invite, 'invite')
  t.equal(invite, 'aaaa')
  t.end()
})

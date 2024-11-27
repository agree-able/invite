import t from 'tap'
import { load, withExternal } from '../index.mjs'

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

t.test('participant requires whoami but host does not', async t => {
  const config = { hostProveWhoami: true }

  // this is on the host side
  const expectations = {
    rules: 'no rules',
    reason: 'no reason',
    whoamiRequired: false
  }
  const roomExpectations = async (input) => {
    console.log('host roomExpectations input', input)
    expectations.whoami = {
      keybase: {
        username: 'host_username',
        challengeResponse: {
          text: input.challengeText,
          armoredSignature: 'server-challenge-response'
        }
      }
    }
    return expectations
  }
  // end host side

  // this is on the participant side
  const verifySignedText = async ({ text, armoredSignature }, username) => {
    t.equal(username, 'host_username', 'host username matches')
    console.log('participant verifyWhoamiSignature', text, armoredSignature)
    // t.equal(signedWhoami.text, 'server-challenge-response', 'challenge response matches')
    return true
  }
  const getKeybaseProofChain = async (username) => {
    t.equal(username, 'host_username', 'host username matches')
    console.log('participant keybase proof chain', username)
    return 'chain'
  }
  const confirmEnterRoom = async (_expectations, hostDetails) => {
    console.log('participant confirm enter room, expectations', _expectations)
    console.log('participant confirm enter room, hostDetails', hostDetails)
    t.ok(hostDetails.whoami.keybase.verfied, 'keybase returned verified, available for confirm enter room')
    return { rules: true, reason: true }
  }
  // end participant side

  // lastly on the host side
  const newRoom = async (input) => {
    console.log('host new room', input)
    return { ok: true, invite: 'aaaa' }
  }
  // end host side

  const result = await withExternal(config, confirmEnterRoom, { roomExpectations, newRoom }, { verifySignedText, getKeybaseProofChain })
  console.log(result)
  t.end()
})

t.test('host does not sign the proper challenge text', async t => {
  const config = { hostProveWhoami: true }
  // this is on the host side
  const expectations = { rules: 'no rules', reason: 'no reason', whoamiRequired: false }
  const roomExpectations = async (input) => {
    expectations.whoami = {
      keybase: {
        username: 'host_username',
        challengeResponse: {
          text: input.challengeText + 'bad',
          armoredSignature: 'server-challenge-response-bad'
        }
      }
    }
    return expectations
  }
  // end host side

  // this is on the participant side
  const verifySignedText = async () => t.fail('should not be called')
  const getKeybaseProofChain = async (_username) => t.fail('should not be called')
  const confirmEnterRoom = async (_expectations, _hostDetails) => t.fail('should not be called')
  // end participant side

  // lastly on the host side
  const newRoom = async (_input) => t.fail('should not be called')
  // end host side

  try {
    await withExternal(config, confirmEnterRoom, { roomExpectations, newRoom }, { verifySignedText, getKeybaseProofChain })
    t.fail('should not be reached')
  } catch (error) {
    t.equal(error.message, 'challengeText was modified', 'error message matches')
    t.ok(error, 'error thrown')
    t.end()
  }
})

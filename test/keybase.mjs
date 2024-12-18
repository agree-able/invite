import t from 'tap'
import fs from 'fs'
import nock from 'nock'
import { signText, verifySignedText, getKeybaseProofChain } from '../keybaseVerification.mjs'

const privateArmored = fs.readFileSync('./test/assets/fake.private.asc', 'utf8')
const publicArmored = fs.readFileSync('./test/assets/fake.public.asc', 'utf8')
const keybaseProofChain = fs.readFileSync('./test/assets/keybaseProofChain.json', 'utf8')

t.test('test sign and verify', async t => {
  const result = await signText('test', privateArmored)

  nock('https://keybase.io')
    .get('/agreeable-test/pgp_keys.asc')
    .reply(200, publicArmored)

  // result.payload += 'fdsfdsa'
  const verified = await verifySignedText(result, 'agreeable-test')

  t.ok(verified)
  t.end()
})

t.test('text is mutated', async t => {
  const result = await signText('test', privateArmored)

  nock('https://keybase.io').get('/agreeable-test/pgp_keys.asc').reply(200, publicArmored)
  result.text += 'fdsfdsa'
  const verified = await verifySignedText(result, 'agreeable-test')
  t.notOk(verified)
  t.end()
})

t.test('signature is mutated', async t => {
  const result = await signText('test', privateArmored)
  nock('https://keybase.io')
    .get('/agreeable-test/pgp_keys.asc')
    .reply(200, publicArmored)
  result.armoredSignature = 'fdsfdsa'
  const verified = await verifySignedText(result, 'agreeable-test')
  t.notOk(verified)
  t.end()
})

t.test('keybase proof chain', async t => {
  nock('https://keybase.io')
    .get('/_/api/1.0/user/lookup.json')
    .query(true) // This will match the exact query string
    .reply(200, JSON.parse(keybaseProofChain))
  const results = await getKeybaseProofChain('agreeable-test')
  t.ok(results)
  t.end()
})

t.test('proof chain not found', async t => {
  nock('https://keybase.io')
    .get('/_/api/1.0/user/lookup.json')
    .query(true) // This will match the exact query string
    .reply(404)
  const results = await getKeybaseProofChain('agreeable-test')
  t.notOk(results)
  t.end()
})

t.test('weird response', async t => {
  nock('https://keybase.io')
    .get('/_/api/1.0/user/lookup.json')
    .query(true) // This will match the exact query string
    .reply(200, { weird: 'response' })
  const results = await getKeybaseProofChain('agreeable-test')
  t.notOk(results)
  t.end()
})

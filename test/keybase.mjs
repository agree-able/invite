import t from 'tap'
import fs from 'fs'
import nock from 'nock'
import { signText, verifySignedText } from '../keybaseVerification.mjs'

const privateArmored = fs.readFileSync('./test/assets/fake.private.asc', 'utf8')
const publicArmored = fs.readFileSync('./test/assets/fake.public.asc', 'utf8')

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

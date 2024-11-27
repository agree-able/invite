import t from 'tap'
import fs from 'fs'
import nock from 'nock'

import { signText, verifySignedText } from '../keybaseVerification.mjs'
t.test('test sign and verify', async t => {
  const armored = fs.readFileSync('./test/assets/fake.private.asc', 'utf8')
  const result = await signText('test', armored)

  nock('https://keybase.io')
    .get('/agreeable-test/pgp_keys.asc')
    .reply(200, fs.readFileSync('./test/assets/fake.public.asc', 'utf8'))

  // result.payload += 'fdsfdsa'
  const verified = await verifySignedText(result, 'agreeable-test')

  t.ok(verified)
  t.end()
})

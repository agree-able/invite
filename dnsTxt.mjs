import { resolveTxt } from './dns.mjs'

export const load = async (domain, proto, label) => {
  let _domain = domain
  if (proto && !domain.startsWith(proto)) _domain = proto + '.' + domain
  return await valueFromDomain(_domain, label) 
}

export const valueFromDomain = async (domain, label) => {
  const records = await resolveTxt(domain) 
  let agreeableKey = null
  console.log(records)
  records.forEach((record) => {
    const asString = record.join('')
    const parts = asString.split('=')
    if (parts[0] === label) agreeableKey = parts[1]
  });
  return agreeableKey
}

export const breakoutRoomKey = async (domain) => load(domain, '_breakoutroom', 'key')
export const didKey = async (domain) => load(domain, '_atproto', 'did')
export const keybaseKey = async (domain) => load(domain, null, 'keybase-site-verification')


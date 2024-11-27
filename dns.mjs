import dns from 'node:dns/promises'

// this is here for later if we need to shim resolveTxt for bare, which does not have it
// https://github.com/holepunchto/bare-dns/issues/1

export const resolveTxt = async (domain) => {
  const records = await dns.resolveTxt(domain)
  return records
}

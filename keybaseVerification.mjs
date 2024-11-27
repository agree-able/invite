import * as openpgp from 'openpgp'
import fetch from 'node-fetch'
import crypto from 'crypto'

export const generateChallengeText = async () => {
  const timestamp = new Date().toISOString()
  const randomBytes = crypto.randomBytes(16).toString('hex')
  return `challenge-${timestamp}-${randomBytes}`
}

export const getKeybaseProofChain = async (keybaseUsername) => {
  try {
    const url = `https://keybase.io/_/api/1.0/user/lookup.json?username=${keybaseUsername}&fields=proofs_summary`
    console.log(url)
    const response = await fetch(url)
    const data = await response.json()
    console.log('daaata', JSON.stringify(data, null, 4))

    if (!data.them || !data.them.proofs_summary) {
      throw new Error('User not found or no proofs available')
    }

    const proofs = data.them.proofs_summary.all
    return proofs.reduce((acc, proof) => {
      // Group proofs by type (domain, github, twitter, etc)
      const type = proof.proof_type
      if (!acc[type]) acc[type] = []
      acc[type].push({
        username: proof.nametag,
        serviceUrl: proof.service_url,
        proofUrl: proof.proof_url,
        presentedUrl: proof.presentation_url,
        state: proof.state
      })
      return acc
    }, {})
  } catch (error) {
    console.error('Error fetching Keybase proof chain:', error)
    return null
  }
}

export const signText = async (text, privateKeyArmored) => {
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored })
  const message = await openpgp.createMessage({ text })
  const armoredSignature = await openpgp.sign({
    message,
    signingKeys: privateKey,
    detached: true
  })
  return {
    text,
    armoredSignature
  }
}

export const verifySignedText = async ({ text, armoredSignature }, keybaseUsername) => {
  try {
    // Fetch public key from keybase
    const response = await fetch(`https://keybase.io/${keybaseUsername}/pgp_keys.asc`)
    const publicKeyArmored = await response.text()
    const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored })

    // Verify signature
    const message = await openpgp.createMessage({ text })
    const signature = await openpgp.readSignature({
      armoredSignature
    })

    const verificationResult = await openpgp.verify({
      message,
      signature,
      verificationKeys: publicKey
    })

    const { verified } = verificationResult.signatures[0]
    await verified
    return verified
  } catch (error) {
    return false
  }
}

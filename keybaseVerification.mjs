import * as openpgp from 'openpgp'
import fetch from 'node-fetch'

export const getKeybaseProofChain = async (keybaseUsername) => {
  try {
    const response = await fetch(`https://keybase.io/_/api/1.0/user/lookup.json?username=${keybaseUsername}&fields=proofs_summary`)
    const data = await response.json()
    
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

export const signWhoami = async (whoami, privateKeyArmored) => {
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored })
  const message = await openpgp.createMessage({ text: JSON.stringify(whoami) })
  const signature = await openpgp.sign({
    message,
    signingKeys: privateKey,
    detached: true
  })
  return {
    payload: whoami,
    signature
  }
}

export const verifyWhoamiSignature = async (signedWhoami, keybaseUsername) => {
  try {
    // Fetch public key from keybase
    const response = await fetch(`https://keybase.io/${keybaseUsername}/pgp_keys.asc`)
    const publicKeyArmored = await response.text()
    console.log('got public key', publicKeyArmored)
    const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored })
    // console.log('got public key', publicKey)

    // Verify signature
    const message = await openpgp.createMessage({ text: JSON.stringify(signedWhoami.payload) })
    const signature = await openpgp.readSignature({
      armoredSignature: signedWhoami.signature
    })
    
    const verificationResult = await openpgp.verify({
      message,
      signature,
      verificationKeys: publicKey
    })

    const { verified } = await verificationResult.signatures[0]
    return verified
  } catch (error) {
    return false
  }
}

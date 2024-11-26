import * as openpgp from 'openpgp'
import fetch from 'node-fetch'

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

    const { verified } = verificationResult
    return verified
  } catch (error) {
    console.error('Verification failed:', error)
    return false
  }
}

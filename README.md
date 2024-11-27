# Agreeable Room Invitations 

A utility for loading and configuring room settings with support for invites, domain-based configuration, and identity verification through Keybase.

## Installation

```bash
npm install @agree-able/invite
```

## Quick Start

```javascript
import { load } from '@agree-able/invite'

// Simple usage with direct invite
const config = { invite: 'your-invite-code' }
const result = await load(config, confirmEnterRoom)

// Domain-based configuration with DID lookup
const config = { 
  domain: 'example.com',
  loadDid: true
}
const result = await load(config, confirmEnterRoom)

// With Keybase verification
const config = {
  domain: 'example.com',
  keybaseUsername: 'username',
  privateKeyArmored: 'your-pgp-key'
}
const result = await load(config, confirmEnterRoom)
```

## The confirmEnterRoom Function

The `confirmEnterRoom` function is required and must handle room entry expectations. It receives room expectations and host details, and should return an acceptance object.

```javascript
const confirmEnterRoom = async (expectations, hostDetails) => {
  // expectations contains room requirements
  // hostDetails may contain verification details if whoami is enabled
  
  console.log('room rules', expectations.rules)
  console.log('room reason', expectations.reason)

  // Example of checking whoami verification
  if (hostDetails?.whoami?.keybase) {
    const { verified, username } = hostDetails.whoami.keybase
    if (!verified) {
      throw new Error(`Keybase verification failed for ${username}`)
    }
  }

  // you must return the acceptance object back to the server
  return {
    reason: true, // 'agree to the reason for the room'
    rules: true // 'agree to the rules for the room'
  }
}
```

## Key Features

- Direct invite code support
- Domain-based room key lookup
- DID (Decentralized Identifier) resolution
- Keybase identity verification
- PGP signing support

## Configuration Options

The `load` function accepts a configuration object with the following options:

- `invite`: Direct invite code (z32 string)
- `domain`: Domain to lookup breakout room key from
- `loadDid`: Whether to load DID from domain
- `whoamiHost`: Enable host whoami verification
- `keybaseUsername`: Keybase username for verification
- `privateKeyArmoredFile`: File location of PGP private key
- `privateKeyArmored`: PGP private key in armored format

## Returns

The function returns a Promise resolving to an object containing:
- `invite`: The room invite code
- `did`: The DID (if requested and available)

## License

MIT

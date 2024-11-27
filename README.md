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
  whoamiHost: true,
  keybaseUsername: 'username',
  privateKeyArmored: 'your-pgp-key'
}
const result = await load(config, confirmEnterRoom)
```

## The confirmEnterRoom Function

The `confirmEnterRoom` function is required and must handle room entry expectations. It receives room expectations and additional info, and should return an acceptance object.

```javascript
const confirmEnterRoom = async (expectations, extraInfo) => {
  // expectations contains room requirements
  // extraInfo may contain verification details if whoami is enabled
  
  // Example of checking room expectations
  if (expectations.maxParticipants > 10) {
    throw new Error('Room too large')
  }

  // Example of checking whoami verification
  if (extraInfo?.whoami?.keybase) {
    const { verified, username } = extraInfo.whoami.keybase
    if (!verified) {
      throw new Error(`Keybase verification failed for ${username}`)
    }
  }

  // Return acceptance object
  return {
    acceptMaxParticipants: expectations.maxParticipants,
    acceptRecording: expectations.recordingAllowed,
    // ... other acceptance parameters
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

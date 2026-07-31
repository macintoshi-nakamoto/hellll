import { createAppKit } from '@reown/appkit/react'
import { tronMainnet } from '@reown/appkit/networks'
import { TronAdapter } from '@reown/appkit-adapter-tron'
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapter-tronlink'
import { TrustAdapter } from '@tronweb3/tronwallet-adapter-trust'

const projectId = 'b7f06c8fd1d9b90aa467a87656d320c1'

// Гард от повторной инициализации при HMR/StrictMode
let appKitInstance = globalThis.__appKitInstance

if (!appKitInstance) {
  const tronAdapter = new TronAdapter({
    walletAdapters: [
      new TronLinkAdapter({
        openUrlWhenWalletNotFound: false,
        checkTimeout: 3000
      }),
      new TrustAdapter(),
    ]
  })


const metadata = {
  name: 'Heleket',
  description: 'Connect your wallet to receive funds',
  url: window.location.origin,
  icons: ['https://heleket.com/ru/apple-icon.png?547980b9327f2287']
}

  appKitInstance = createAppKit({
    adapters: [tronAdapter],
    networks: [tronMainnet],
    defaultNetwork: tronMainnet,
    projectId,
    metadata,
    themeMode: 'dark',
    includeWalletIds: [
      '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0'
    ],
    featuredWalletIds: [
      '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0'
    ],
    features: {
      analytics: false,
      email: false,
      socials: false
    }
  })

  globalThis.__appKitInstance = appKitInstance
}

export { appKitInstance }
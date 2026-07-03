import { createAppKit } from '@reown/appkit/react'
import { tronMainnet } from '@reown/appkit/networks'   // ← важно: tronMainnet
import { TronAdapter } from '@reown/appkit-adapter-tron'

// Wallet adapters для Tron (рекомендуется добавить несколько)
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapter-tronlink'
import { TrustAdapter } from '@tronweb3/tronwallet-adapter-trust'
// import { MetaMaskAdapter } from '@tronweb3/tronwallet-adapter-metamask-tron'
// и т.д.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PaymentPage from './page/PaymentPage/PaymentPage'
import './App.css'

const projectId = 'b7f06c8fd1d9b90aa467a87656d320c1'

const queryClient = new QueryClient()

const metadata = {
  name: 'Heleket',
  description: 'Connect your wallet to receive funds',
  url: window.location.origin,
  icons: ['https://heleket.com/ru/apple-icon.png?547980b9327f2287']
}

// ==================== ТОЛЬКО TRON ====================
const tronAdapter = new TronAdapter({
  walletAdapters: [
    new TronLinkAdapter({
      openUrlWhenWalletNotFound: false,
      checkTimeout: 3000
    }),
    new TrustAdapter(),           // Trust Wallet
    // new MetaMaskAdapter(),     // если нужен MetaMask Tron
  ]
})

createAppKit({
  adapters: [tronAdapter],        // ← Убрали wagmiAdapter
  networks: [tronMainnet],        // ← Только Tron
  defaultNetwork: tronMainnet,    // ← Жёстко Tron
  projectId,
  metadata,
  themeMode: 'dark',

  includeWalletIds: [
    // Trust Wallet ID (оставь, если нужно)
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PaymentPage />
    </QueryClientProvider>
  )
}

export default App
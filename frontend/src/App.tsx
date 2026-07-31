// App.jsx
import './appkit'   // side-effect import — инициализация происходит один раз
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PaymentPage from './page/PaymentPage/PaymentPage'
import './App.css'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PaymentPage />
    </QueryClientProvider>
  )
}

export default App
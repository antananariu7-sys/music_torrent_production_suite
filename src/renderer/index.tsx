import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import App from './App'
import { system } from './theme'
import './styles/global.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ChakraProvider value={system}>
      <App />
    </ChakraProvider>
  </React.StrictMode>
)

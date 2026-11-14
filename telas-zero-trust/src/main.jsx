import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { criarAutenticadorOidc } from './auth/oidc.js'

// Um único autenticador para a aplicação inteira (login com o Keycloak).
const autenticador = criarAutenticadorOidc()

// Sem <StrictMode> de propósito: em desenvolvimento ele executa cada carregamento de dados
// duas vezes, e cada chamada ao gateway gera um registro de auditoria. Isso confundiria a demonstração.
createRoot(document.getElementById('root')).render(<App autenticador={autenticador} />)

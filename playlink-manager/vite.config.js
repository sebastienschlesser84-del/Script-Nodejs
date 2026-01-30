import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Permet d'écouter sur toutes les interfaces réseau (accessible via IP locale)
    port: 5173, // Port par défaut de Vite
    proxy: {
      // Configuration du Proxy pour contourner les erreurs CORS
      // Toute requête vers http://localhost:5173/api/... sera redirigée vers http://127.0.0.1:5500/api/...
      '/api': {
        target: 'http://127.0.0.1:5500',
        changeOrigin: true,
        secure: false, // Accepte le HTTP sans certificat SSL si besoin
        // rewrite: (path) => path.replace(/^\/api/, '') // Décommenter si l'API cible n'attend pas le préfixe /api
      }
    }
  }
})
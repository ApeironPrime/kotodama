import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@tanstack/react-query')) return 'query-vendor'
          if (id.includes('react-hook-form')) return 'form-vendor'
          if (id.includes('axios')) return 'api-vendor'
          if (id.includes('react-router')) return 'router-vendor'
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('scheduler'))
            return 'react-vendor'
          return 'vendor'
        },
      },
    },
  },
  test: {
    testTimeout: 10000,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/features/auth/permissions.ts',
        'src/features/srs/ReviewPage.tsx',
        'src/features/video/VideoLearningPage.tsx',
        'src/features/learning/CoursesPage.tsx',
        'src/lib/apiClient.ts',
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 70,
        lines: 85,
      },
    },
  },
  server: {
    proxy: {
      // Route all /api requests directly to Kotodama local backend API
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})

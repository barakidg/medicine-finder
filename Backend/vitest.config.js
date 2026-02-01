import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // This ensures environment variables are available
        env: {
            JWT_SECRET: 'test123'
        }
    }
})
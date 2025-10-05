#!/usr/bin/env node
import { ElectronMCPServer } from './electron-mcp-server.js'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.error(`Script directory: ${__dirname}`)

// Add process error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Get Electron app path from CLI argument, environment variable
const appExePath = process.argv[2] || process.env.ELECTRON_APP_PATH as string

// Validate that the path exists
if (appExePath && !existsSync(appExePath)) {
  console.error(`❌ Electron app not found at: ${appExePath}`)
  console.error('\nUsage:')
  console.error('  node dist/index.js <path-to-electron-app>')
  console.error('  ELECTRON_APP_PATH=<path> node dist/index.js')
  console.error('\nExample:')
  console.error('  node dist/index.js /path/to/your-app.app/Contents/MacOS/your-app')
  process.exit(1)
}

console.error(`Using Electron app at: ${appExePath}`)

const server = new ElectronMCPServer({ appExePath })
server
  .run()
  .then(() => {
    return server.initRenderer()
  })
  .catch((error) => {
    console.error('Server startup failed:', error)
    process.exit(1)
  })

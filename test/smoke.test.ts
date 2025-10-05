import { test, expect } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ES module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class MCPClient {
  private serverProcess: ChildProcess | null = null
  private requestId = 1

  async startServer(): Promise<void> {
    const serverPath = join(__dirname, '..', 'dist', 'index.js')

    this.serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  async sendRequest(method: string, params: any = {}): Promise<any> {
    if (!this.serverProcess) {
      throw new Error('Server not started')
    }

    const request = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params
    }

    return new Promise((resolve, reject) => {
      let responseData = ''
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'))
      }, 30000)

      const onData = (data: Buffer) => {
        responseData += data.toString()

        // Try to parse JSON response line by line
        const lines = responseData.split('\n')
        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line)
              if (response.id === request.id) {
                clearTimeout(timeout)
                this.serverProcess!.stdout!.off('data', onData)

                if (response.error) {
                  reject(new Error(response.error.message))
                } else {
                  resolve(response.result)
                }
                return
              }
            } catch (e) {
              // Continue collecting data
            }
          }
        }
      }

      this.serverProcess!.stdout!.on('data', onData)
      this.serverProcess!.stdin!.write(JSON.stringify(request) + '\n')
    })
  }

  async stop(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill()
      this.serverProcess = null
    }
  }
}

test.describe('MCP Server Smoke Tests', () => {
  let client: MCPClient

  test.beforeAll(async () => {
    client = new MCPClient()
    await client.startServer()
  })

  test.afterAll(async () => {
    await client.stop()
  })

  test('should list all available tools', async () => {
    const result = await client.sendRequest('tools/list')

    expect(result).toBeDefined()
    expect(result.tools).toBeDefined()
    expect(Array.isArray(result.tools)).toBe(true)

    // Check that we have all expected tools
    const toolNames = result.tools.map((tool: any) => tool.name)

    const expectedTools = [
      'browser_navigate',
      'browser_navigate_back',
      'browser_click',
      'browser_type',
      'browser_press_key',
      'browser_fill_form',
      'browser_select_option',
      'browser_hover',
      'browser_drag',
      'browser_snapshot',
      'browser_take_screenshot',
      'browser_evaluate',
      'browser_file_upload',
      'browser_tabs',
      'browser_handle_dialog',
      'browser_wait_for',
      'browser_resize',
      'browser_close',
      'browser_network_requests',
      'browser_console_messages'
    ]

    for (const toolName of expectedTools) {
      expect(toolNames).toContain(toolName)
    }

    console.log(`✅ Found ${result.tools.length} tools`)
  })

  test('should navigate to Electron app', async () => {
    const result = await client.sendRequest('tools/call', {
      name: 'browser_navigate',
      arguments: { url: '' }
    })

    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    expect(result.content[0].type).toBe('text')
    expect(result.content[0].text).toContain('Navigated to:')
    expect(result.content[0].text).toContain('Status: success')

    console.log('✅ Navigation successful:', result.content[0].text)
  })

  test('should take a screenshot', async () => {
    // First navigate
    await client.sendRequest('tools/call', {
      name: 'browser_navigate',
      arguments: { url: '' }
    })

    // Wait a bit for page to load
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Take screenshot
    const result = await client.sendRequest('tools/call', {
      name: 'browser_take_screenshot',
      arguments: { filename: 'smoke-test.png' }
    })

    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    expect(result.content[0].text).toContain('Screenshot saved to:')
    expect(result.content[0].text).toContain('smoke-test.png')

    console.log('✅ Screenshot saved:', result.content[0].text)
  })

  test('should execute JavaScript on the page', async () => {
    // First navigate
    await client.sendRequest('tools/call', {
      name: 'browser_navigate',
      arguments: { url: '' }
    })

    // Wait a bit for page to load
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Execute JavaScript
    const result = await client.sendRequest('tools/call', {
      name: 'browser_evaluate',
      arguments: {
        function: '() => ({ title: document.title, readyState: document.readyState })'
      }
    })

    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    expect(result.content[0].text).toContain('JavaScript evaluation result:')

    console.log('✅ JavaScript executed:', result.content[0].text)
  })
})

test.describe('MCP Server Integration Tests', () => {
  let client: MCPClient

  test.beforeAll(async () => {
    client = new MCPClient()
    await client.startServer()
  })

  test.afterAll(async () => {
    await client.stop()
  })

  test('should navigate to external URL and take screenshot', async () => {
    // Navigate to external URL
    const navResult = await client.sendRequest('tools/call', {
      name: 'browser_navigate',
      arguments: { url: 'https://example.com' }
    })

    expect(navResult.content[0].text).toContain('Status: success')

    // Wait for page load
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Take screenshot
    const screenshotResult = await client.sendRequest('tools/call', {
      name: 'browser_take_screenshot',
      arguments: { filename: 'example-com.png' }
    })

    expect(screenshotResult.content[0].text).toContain('Screenshot saved to:')

    console.log('✅ External navigation and screenshot successful')
  })

  test('should handle multiple sequential requests', async () => {
    // Navigate
    await client.sendRequest('tools/call', {
      name: 'browser_navigate',
      arguments: { url: '' }
    })

    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Take first screenshot
    const screenshot1 = await client.sendRequest('tools/call', {
      name: 'browser_take_screenshot',
      arguments: { filename: 'test-1.png' }
    })

    expect(screenshot1.content[0].text).toContain('test-1.png')

    // Evaluate JavaScript
    const evalResult = await client.sendRequest('tools/call', {
      name: 'browser_evaluate',
      arguments: {
        function: '() => document.title'
      }
    })

    expect(evalResult.content[0].text).toContain('JavaScript evaluation result:')

    // Take second screenshot
    const screenshot2 = await client.sendRequest('tools/call', {
      name: 'browser_take_screenshot',
      arguments: { filename: 'test-2.png' }
    })

    expect(screenshot2.content[0].text).toContain('test-2.png')

    console.log('✅ Multiple sequential requests successful')
  })
})

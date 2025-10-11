import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js'
import { ElectronBrowserManager } from './electron-browser-manager.js'
import { generateToolSchemas, getTool, ToolName, TOOL_REGISTRY } from './tools-registry.js'

const isToolName = (value: string): value is ToolName =>
  Object.prototype.hasOwnProperty.call(TOOL_REGISTRY, value)

export class ElectronMCPServer {
  private server: Server
  private browserManager: ElectronBrowserManager
  private appExePath: string

  constructor({ appExePath }: { appExePath: string }) {
    this.appExePath = appExePath
    this.server = new Server(
      {
        name: 'electron-playwright-mcp',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    this.browserManager = new ElectronBrowserManager()
    this.setupToolHandlers()
  }

  async initRenderer(): Promise<void> {
    await this.browserManager.initBrowserManager(this.appExePath)
  }

  async run(): Promise<void> {
    try {
      console.error('🚀 Starting Electron MCP Server...')
      const transport = new StdioServerTransport()
      await this.server.connect(transport)
      console.error('✅ Electron MCP Server running on stdio')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ Failed to start MCP Server: ${errorMessage}`)
      console.error(
        'Stack trace:',
        error instanceof Error ? error.stack : 'No stack trace available'
      )
      throw error
    }
  }

  /** @todo Check if we can control the shutdown from the Electron app */
  async shutdown(): Promise<void> {}

  private setupToolHandlers() {
    // List available tools - generated from registry
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: generateToolSchemas()
      }
    })

    // Handle tool calls - dispatch using registry
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        if (!isToolName(name)) {
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
        }

        const tool = getTool(name)

        // Validate arguments against schema
  const validatedArgs = tool.schema.parse(args ?? {})
  const validatedArgs2 = tool.schema.parse(args)

  // Execute handler and adapt response to MCP result shape
  const result = await tool.handler(this.browserManager, validatedArgs as never)
        return {
          content: result.content.map((item) => ({
            type: item.type as 'text',
            text: item.text
          }))
        } satisfies CallToolResult
      } catch (error) {
        if (error instanceof McpError) {
          throw error
        }
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`)
      }
    })
  }
}

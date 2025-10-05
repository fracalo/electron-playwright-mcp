import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { ElectronBrowserManager } from './electron-browser-manager.js'

// Zod schemas for each tool
export const NavigateSchema = z.object({
  url: z.string().describe('URL identifier or empty string for first available browser window')
})

export const ClickSchema = z.object({
  element: z.string().describe('Human-readable element description'),
  ref: z.string().describe('Exact target element reference from page snapshot')
})

export const TypeSchema = z.object({
  element: z.string().describe('Human-readable element description'),
  ref: z.string().describe('Element reference'),
  text: z.string().describe('Text to type'),
  slowly: z.boolean().optional().describe('Type one character at a time'),
  submit: z.boolean().optional().describe('Press Enter after typing')
})

export const PressKeySchema = z.object({
  key: z.string().describe("Key name (e.g., 'ArrowLeft', 'Enter', 'a')")
})

export const FillFormSchema = z.object({
  fields: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        ref: z.string(),
        value: z.string()
      })
    )
    .describe('Array of form fields to fill')
})

export const SelectOptionSchema = z.object({
  element: z.string().describe('Element description'),
  ref: z.string().describe('Element reference'),
  values: z.array(z.string()).describe('Values to select')
})

export const HoverSchema = z.object({
  element: z.string().describe('Element description'),
  ref: z.string().describe('Element reference')
})

export const DragSchema = z.object({
  startElement: z.string().describe('Source element description'),
  startRef: z.string().describe('Source element reference'),
  endElement: z.string().describe('Target element description'),
  endRef: z.string().describe('Target element reference')
})

export const TakeScreenshotSchema = z.object({
  filename: z.string().optional().describe('Custom filename'),
  element: z.string().optional().describe('Element description for element screenshot'),
  ref: z.string().optional().describe('Element reference for element screenshot'),
  fullPage: z.boolean().optional().describe('Full page screenshot'),
  type: z.enum(['png', 'jpeg']).optional().describe('Image format')
})

export const EvaluateSchema = z.object({
  function: z.string().describe('JavaScript function to execute'),
  element: z.string().optional().describe('Element description for element-specific execution'),
  ref: z.string().optional().describe('Element reference')
})

export const FileUploadSchema = z.object({
  paths: z.array(z.string()).describe('Array of absolute file paths to upload')
})

export const ManageTabsSchema = z.object({
  action: z.enum(['list', 'new', 'close', 'select']).describe('Operation to perform'),
  index: z.number().optional().describe('Tab index for close/select operations')
})

export const HandleDialogSchema = z.object({
  accept: z.boolean().describe('Whether to accept the dialog'),
  promptText: z.string().optional().describe('Text for prompt dialogs')
})

export const WaitForSchema = z.object({
  text: z.string().optional().describe('Text to wait for'),
  textGone: z.string().optional().describe('Text to wait for to disappear'),
  time: z.number().optional().describe('Time to wait in seconds')
})

export const ResizeSchema = z.object({
  width: z.number().describe('Window width'),
  height: z.number().describe('Window height')
})

// Tool result type
export interface ToolResult {
  content: Array<{
    type: string
    text: string
  }>
}

// Tool definition interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ToolDefinition<T = any> {
  description: string
  schema: z.ZodSchema<T>
  handler: (manager: ElectronBrowserManager, args: T) => Promise<ToolResult>
}

// Tool registry - single source of truth
export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  // Navigation & Page Management
  browser_navigate: {
    description: 'Navigate to URLs or switch between Electron renderer processes',
    schema: NavigateSchema,
    handler: (manager, args) => manager.navigate(args)
  },
  browser_navigate_back: {
    description: 'Go back to previous page in browser history',
    schema: z.object({}),
    handler: (manager) => manager.navigateBack()
  },

  // Page Interaction
  browser_click: {
    description: 'Click on elements using element description and ref ID',
    schema: ClickSchema,
    handler: (manager, args) => manager.click(args)
  },
  browser_type: {
    description: 'Type text into editable elements',
    schema: TypeSchema,
    handler: (manager, args) => manager.type(args)
  },
  browser_press_key: {
    description: 'Press keyboard keys',
    schema: PressKeySchema,
    handler: (manager, args) => manager.pressKey(args)
  },
  browser_fill_form: {
    description: 'Fill multiple form fields at once',
    schema: FillFormSchema,
    handler: (manager, args) => manager.fillForm(args)
  },
  browser_select_option: {
    description: 'Select options in dropdown menus',
    schema: SelectOptionSchema,
    handler: (manager, args) => manager.selectOption(args)
  },
  browser_hover: {
    description: 'Hover over elements',
    schema: HoverSchema,
    handler: (manager, args) => manager.hover(args)
  },
  browser_drag: {
    description: 'Perform drag and drop operations between elements',
    schema: DragSchema,
    handler: (manager, args) => manager.drag(args)
  },

  // Page Analysis & Content
  browser_snapshot: {
    description: 'Capture accessibility snapshot of current page',
    schema: z.object({}),
    handler: (manager) => manager.snapshot()
  },
  browser_take_screenshot: {
    description: 'Take screenshots of viewport or specific elements',
    schema: TakeScreenshotSchema,
    handler: (manager, args) => manager.takeScreenshot(args)
  },
  browser_evaluate: {
    description: 'Execute JavaScript expressions on the page',
    schema: EvaluateSchema,
    handler: (manager, args) => manager.evaluate(args)
  },

  // File & Media Operations
  browser_file_upload: {
    description: 'Upload files to file input elements',
    schema: FileUploadSchema,
    handler: (manager, args) => manager.fileUpload(args)
  },

  // Tab Management
  browser_tabs: {
    description: 'List, create, close, or select browser tabs',
    schema: ManageTabsSchema,
    handler: (manager, args) => manager.manageTabs(args)
  },

  // Advanced Features
  browser_handle_dialog: {
    description: 'Handle browser dialogs (alerts, confirms, prompts)',
    schema: HandleDialogSchema,
    handler: (manager, args) => manager.handleDialog(args)
  },
  browser_wait_for: {
    description: 'Wait for specific conditions',
    schema: WaitForSchema,
    handler: (manager, args) => manager.waitFor(args)
  },

  // Browser Management
  browser_resize: {
    description: 'Resize browser window',
    schema: ResizeSchema,
    handler: (manager, args) => manager.resize(args)
  },
  browser_close: {
    description: 'Close the browser',
    schema: z.object({}),
    handler: (manager) => manager.close()
  },

  // Network & Debugging
  browser_network_requests: {
    description: 'Returns all network requests since page load',
    schema: z.object({}),
    handler: (manager) => manager.getNetworkRequests()
  },
  browser_console_messages: {
    description: 'Returns all console log messages',
    schema: z.object({}),
    handler: (manager) => manager.getConsoleMessages()
  }
}

// Helper to generate MCP tool schemas
export function generateToolSchemas() {
  return Object.entries(TOOL_REGISTRY).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.schema, { target: 'jsonSchema7' })
  }))
}

// Helper to find tool by name
export function findTool(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY[name]
}

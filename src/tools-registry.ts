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

// Strongly typed tool definition
export interface ToolDefinition<TSchema extends z.ZodSchema> {
  description: string
  schema: TSchema
  handler: (manager: ElectronBrowserManager, args: z.infer<TSchema>) => Promise<ToolResult>
}

// Helper type alias for cleaner code
type TypedToolDefinition<TSchema extends z.ZodSchema> = ToolDefinition<TSchema>

// Helper function to create typed tool definitions
const createTool = <TSchema extends z.ZodSchema>(
  description: string,
  schema: TSchema,
  handler: (manager: ElectronBrowserManager, args: z.infer<TSchema>) => Promise<ToolResult>
): TypedToolDefinition<TSchema> => ({ description, schema, handler })

// Tool registry - single source of truth with proper typing
export const TOOL_REGISTRY = {
  // Navigation & Page Management
  browser_navigate: createTool(
    'Navigate to URLs or switch between Electron renderer processes',
    NavigateSchema,
    (manager, args) => manager.navigate(args)
  ),
  browser_navigate_back: createTool(
    'Go back to previous page in browser history',
    z.object({}),
    (manager) => manager.navigateBack()
  ),

  // Page Interaction
  browser_click: createTool(
    'Click on elements using element description and ref ID',
    ClickSchema,
    (manager, args) => manager.click(args)
  ),
  browser_type: createTool(
    'Type text into editable elements',
    TypeSchema,
    (manager, args) => manager.type(args)
  ),
  browser_press_key: createTool(
    'Press keyboard keys',
    PressKeySchema,
    (manager, args) => manager.pressKey(args)
  ),
  browser_fill_form: createTool(
    'Fill multiple form fields at once',
    FillFormSchema,
    (manager, args) => manager.fillForm(args)
  ),
  browser_select_option: createTool(
    'Select options in dropdown menus',
    SelectOptionSchema,
    (manager, args) => manager.selectOption(args)
  ),
  browser_hover: createTool(
    'Hover over elements',
    HoverSchema,
    (manager, args) => manager.hover(args)
  ),
  browser_drag: createTool(
    'Perform drag and drop operations between elements',
    DragSchema,
    (manager, args) => manager.drag(args)
  ),

  // Page Analysis & Content
  browser_snapshot: createTool(
    'Capture accessibility snapshot of current page',
    z.object({}),
    (manager) => manager.snapshot()
  ),
  browser_take_screenshot: createTool(
    'Take screenshots of viewport or specific elements',
    TakeScreenshotSchema,
    (manager, args) => manager.takeScreenshot(args)
  ),
  browser_evaluate: createTool(
    'Execute JavaScript expressions on the page',
    EvaluateSchema,
    (manager, args) => manager.evaluate(args)
  ),

  // File & Media Operations
  browser_file_upload: createTool(
    'Upload files to file input elements',
    FileUploadSchema,
    (manager, args) => manager.fileUpload(args)
  ),

  // Tab Management
  browser_tabs: createTool(
    'List, create, close, or select browser tabs',
    ManageTabsSchema,
    (manager, args) => manager.manageTabs(args)
  ),

  // Advanced Features
  browser_handle_dialog: createTool(
    'Handle browser dialogs (alerts, confirms, prompts)',
    HandleDialogSchema,
    (manager, args) => manager.handleDialog(args)
  ),
  browser_wait_for: createTool(
    'Wait for specific conditions',
    WaitForSchema,
    (manager, args) => manager.waitFor(args)
  ),

  // Browser Management
  browser_resize: createTool(
    'Resize browser window',
    ResizeSchema,
    (manager, args) => manager.resize(args)
  ),
  browser_close: createTool(
    'Close the browser',
    z.object({}),
    (manager) => manager.close()
  ),

  // Network & Debugging
  browser_network_requests: createTool(
    'Returns all network requests since page load',
    z.object({}),
    (manager) => manager.getNetworkRequests()
  ),
  browser_console_messages: createTool(
    'Returns all console log messages',
    z.object({}),
    (manager) => manager.getConsoleMessages()
  )
} as const

// Helper to generate MCP tool schemas
export function generateToolSchemas() {
  return Object.entries(TOOL_REGISTRY).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.schema, { target: 'jsonSchema7' })
  }))
}

// Type utilities for strongly typed tool access
export type ToolName = keyof typeof TOOL_REGISTRY

// Strongly typed tool accessor (for when you know the tool name at compile time)
export function getTool<T extends ToolName>(name: T): typeof TOOL_REGISTRY[T] {
  return TOOL_REGISTRY[name]
}

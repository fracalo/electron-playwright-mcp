# electron-playwright-mcp

A Model Context Protocol (MCP) server that provides browser automation capabilities for Electron applications using Playwright. This enables AI assistants and other MCP clients to interact with Electron apps through structured, accessibility-first automation.

## Overview

**electron-playwright-mcp** allows you to run any Electron application through Playwright while maintaining full user interactivity. The Electron app operates normally for manual use, but MCP clients (like Claude Desktop) can simultaneously drive the application programmatically through browser automation tools.

This bridges the gap between:

- **Human interaction**: Users can interact with the Electron app as usual
- **AI automation**: AI assistants can read, navigate, and interact with the app through MCP tools

## Requirements

- Node.js 18 or newer
- A built Electron application to automate

## Installation

```bash
npm install electron-playwright-mcp
```

Or use directly with npx:

```bash
npx electron-playwright-mcp /path/to/your/electron/app
```

## Usage

### Running the Server

The server requires the path to your Electron application's executable:

**Via CLI:**
```bash
node dist/index.js /path/to/YourApp.app/Contents/MacOS/YourApp
```

**Via environment variable:**
```bash
ELECTRON_APP_PATH=/path/to/YourApp.app/Contents/MacOS/YourApp npm start
```

**Via npx:**
```bash
npx electron-playwright-mcp /path/to/YourApp.app/Contents/MacOS/YourApp
```

### Path Structure

- **macOS**: `/Applications/YourApp.app/Contents/MacOS/YourApp`
- **Linux**: `/usr/bin/your-app` or similar
- **Windows**: `C:\Program Files\YourApp\YourApp.exe`

## Configuration

### Claude Desktop

To use with Claude Desktop, add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "electron-playwright-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/electron-playwright-mcp/dist/index.js",
        "/absolute/path/to/YourApp.app/Contents/MacOS/YourApp"
      ]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "electron-playwright-mcp": {
      "command": "npx",
      "args": [
        "electron-playwright-mcp",
        "/absolute/path/to/YourApp.app/Contents/MacOS/YourApp"
      ]
    }
  }
}
```

Or using environment variables:

```json
{
  "mcpServers": {
    "electron-playwright-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/electron-playwright-mcp/dist/index.js"],
      "env": {
        "ELECTRON_APP_PATH": "/absolute/path/to/YourApp.app/Contents/MacOS/YourApp"
      }
    }
  }
}
```

After adding the configuration, restart Claude Desktop. You can verify the connection by asking Claude to interact with your Electron app.

### Other MCP Clients

electron-playwright-mcp works with any MCP-compatible client:
- VS Code with MCP extension
- Cursor
- Zed
- Custom MCP clients

Configure according to your client's MCP server setup documentation.

## Available Tools

electron-playwright-mcp provides comprehensive browser automation capabilities through MCP tools:

### Navigation & Page Management
- `browser_navigate` - Navigate to URLs or switch between renderer processes
- `browser_navigate_back` - Go back in browser history

### Page Interaction
- `browser_click` - Click elements using ref IDs from snapshots
- `browser_type` - Type text into input fields
- `browser_press_key` - Press keyboard keys
- `browser_fill_form` - Fill multiple form fields at once
- `browser_select_option` - Select dropdown options
- `browser_hover` - Hover over elements
- `browser_drag` - Drag and drop between elements

### Page Analysis
- `browser_snapshot` - Capture accessibility tree of current page
- `browser_take_screenshot` - Take screenshots (viewport or specific elements)
- `browser_evaluate` - Execute JavaScript in the page context

### Advanced Features
- `browser_file_upload` - Upload files to file inputs
- `browser_tabs` - Manage multiple windows
- `browser_handle_dialog` - Handle alerts/confirms/prompts
- `browser_wait_for` - Wait for conditions (text, timeouts)
- `browser_resize` - Resize browser window
- `browser_close` - Close the browser

### Network & Debugging
- `browser_network_requests` - View all network requests
- `browser_console_messages` - View console logs

## How It Works

### Element Reference System

1. **Take a snapshot**: Call `browser_snapshot` to get a structured view of the page
2. **Elements get refs**: Each interactive element receives a unique reference (e.g., `e100`, `e101`)
3. **Use refs for interaction**: Use these refs with tools like `browser_click`, `browser_type`, etc.

Example workflow:
```javascript
// 1. Get page structure
browser_snapshot()
// Returns: element with ref="e123" is a search input

// 2. Interact with the element
browser_type({
  element: "Search input",
  ref: "e123",
  text: "query text"
})

// 3. Take a new snapshot after page changes
browser_snapshot()
```

### Architecture

```
┌─────────────────┐
│  MCP Client     │  (Claude Desktop, VS Code, etc.)
│  (AI Assistant) │
└────────┬────────┘
         │ MCP Protocol (stdio)
         │
┌────────▼────────┐
│ electron-playwright-mcp    │
│ Server          │
└────────┬────────┘
         │ Playwright API
         │
┌────────▼────────┐
│ Electron App    │  ◄── User can still interact manually
│ (Your App)      │
└─────────────────┘
```

The server acts as a bridge, translating MCP tool calls into Playwright commands that drive your Electron application.

## Development

### Setup

```bash
git clone https://github.com/yourusername/electron-playwright-mcp.git
cd electron-playwright-mcp
npm install
```

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Testing

Tests require an Electron app to automate. Set `ELECTRON_APP_PATH` before running tests:

```bash
ELECTRON_APP_PATH=/path/to/app npm test
```

Or for smoke tests only:

```bash
ELECTRON_APP_PATH=/path/to/app npm run test:smoke
```

Tests are automatically skipped if no Electron app path is provided.

## Use Cases

### AI-Assisted Desktop Automation
Let AI assistants help you navigate complex Electron applications, fill forms, extract data, or perform repetitive tasks.

### Testing & QA
Use AI to generate test cases, explore application flows, and identify edge cases in your Electron apps.

### Accessibility Analysis
Leverage AI to analyze your app's accessibility tree and suggest improvements.

### Documentation & Tutorials
Generate step-by-step guides by having AI interact with and document your application.

### Data Migration
Automate data entry from one application to another with AI assistance.

## Comparison with playwright-mcp

| Feature | electron-playwright-mcp | playwright-mcp |
|---------|--------------|----------------|
| Target | Electron desktop apps | Web browsers |
| Use Case | Desktop app automation | Web automation |
| Browser Support | Electron only | Chromium, Firefox, WebKit |
| App Control | Launches specific Electron app | Launches headless/headed browser |
| Ideal For | Desktop tool automation | Web scraping, testing |

## Troubleshooting

### Server won't start
- Verify the Electron app path is correct and the file exists
- Check that the path points to the executable (not the `.app` folder on macOS)
- Ensure you have permission to execute the Electron app

### Elements not found
- Always take a fresh `browser_snapshot` after page changes
- Element refs are regenerated on each snapshot
- Verify the element is visible and loaded before interaction

### Connection issues with Claude Desktop
- Check that paths in `claude_desktop_config.json` are absolute, not relative
- Restart Claude Desktop after configuration changes
- Check Claude Desktop logs for error messages

### Playwright errors
- Ensure Playwright browsers are installed: `npx playwright install`
- Check for conflicting Playwright versions in dependencies

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Related Projects

- [playwright-mcp](https://github.com/microsoft/playwright-mcp) - MCP server for web browser automation
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification and documentation
- [Playwright](https://playwright.dev/) - Browser automation library

## Acknowledgments

Built on top of:
- [Playwright](https://playwright.dev/) for browser automation
- [MCP SDK](https://github.com/modelcontextprotocol/sdk) for Model Context Protocol implementation
- Inspired by [playwright-mcp](https://github.com/microsoft/playwright-mcp)

import { _electron, Page, ElectronApplication } from '@playwright/test'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'

interface NetworkRequest {
  url: string
  method: string
  status?: number
  contentType?: string
  timestamp: number
}

interface ConsoleMessage {
  type: string
  text: string
  timestamp: number
  location?: string
}

interface ElementSnapshot {
  ref: string
  role: string
  name: string
  tag: string
  depth: number
  clickable: boolean
  type?: string
  value?: string
  attributes?: Record<string, string | undefined>
}

interface ElementSnapshotWithSelector extends ElementSnapshot {
  selector: string
}

export class ElectronBrowserManager {
  private electronApp: ElectronApplication | null = null
  private currentPage: Page | null = null
  private pages: Page[] = []
  private networkRequests: NetworkRequest[] = []
  private consoleMessages: ConsoleMessage[] = []
  private screenshotDir = join(tmpdir(), 'electron-mcp')
  private elementRefMap = new Map<string, string>()
  refCounter: number = 100

  constructor() {
    this.ensureScreenshotDir()
  }

  async initBrowserManager(executablePath: string) {
    this.electronApp = await _electron.launch({
      executablePath,
      timeout: 0,
      args: []
    })
    this.currentPage = await this.electronApp.firstWindow()
    this.pages = [this.currentPage]
    this.setupEventListeners()
  }

  private ensureScreenshotDir(): void {
    if (!existsSync(this.screenshotDir)) {
      mkdirSync(this.screenshotDir, { recursive: true })
    }
  }

  private setupEventListeners() {
    if (!this.currentPage) return

    // Track network requests
    this.currentPage.on('request', (request) => {
      this.networkRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now()
      })
    })

    this.currentPage.on('response', (response) => {
      const existing = this.networkRequests.find((r) => r.url === response.url() && !r.status)
      if (existing) {
        existing.status = response.status()
        existing.contentType = response.headers()['content-type']
      }
    })

    // Track console messages
    this.currentPage.on('console', (message) => {
      this.consoleMessages.push({
        type: message.type(),
        text: message.text(),
        timestamp: Date.now(),
        location: message.location()?.url
      })
    })

    // Handle dialogs
    this.currentPage.on('dialog', async (dialog) => {
      console.log(`Dialog appeared: ${dialog.type()} - ${dialog.message()}`)
      // Auto-dismiss for now, can be controlled via browser_handle_dialog
      await dialog.dismiss()
    })
  }

  async navigate(params: { url: string }) {
    if (!params.url || params.url === '') {
      // Navigate to first available browser window (already done)
      const title = await this.currentPage!.title()
      const url = this.currentPage!.url()

      return {
        content: [
          {
            type: 'text',
            text: `Navigated to: ${title}\nURL: ${url}\nStatus: success`
          }
        ]
      }
    } else {
      await this.currentPage!.goto(params.url)
      const title = await this.currentPage!.title()
      const url = this.currentPage!.url()

      return {
        content: [
          {
            type: 'text',
            text: `Navigated to: ${title}\nURL: ${url}\nStatus: success`
          }
        ]
      }
    }
  }

  async navigateBack() {
    if (!this.currentPage) throw new Error('Browser not initialized')

    await this.currentPage.goBack()
    const title = await this.currentPage.title()
    const url = this.currentPage.url()

    return {
      content: [
        {
          type: 'text',
          text: `Navigated back to: ${title}\nURL: ${url}`
        }
      ]
    }
  }

  async click(params: { element: string; ref: string }) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    const selector = this.elementRefMap.get(params.ref)
    if (!selector) {
      throw new Error(`Element reference ${params.ref} not found. Please take a snapshot first.`)
    }

    await this.currentPage.click(selector)

    return {
      content: [
        {
          type: 'text',
          text: `Clicked on ${params.element} (ref: ${params.ref})`
        }
      ]
    }
  }

  async type(params: {
    element: string
    ref: string
    text: string
    slowly?: boolean
    submit?: boolean
  }) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    const selector = this.elementRefMap.get(params.ref)
    if (!selector) {
      throw new Error(`Element reference ${params.ref} not found. Please take a snapshot first.`)
    }

    if (params.slowly) {
      await this.currentPage.type(selector, params.text, { delay: 100 })
    } else {
      await this.currentPage.fill(selector, params.text)
    }

    if (params.submit) {
      await this.currentPage.press(selector, 'Enter')
    }

    return {
      content: [
        {
          type: 'text',
          text: `Typed "${params.text}" into ${params.element} (ref: ${params.ref})`
        }
      ]
    }
  }

  async pressKey(params: { key: string }) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    await this.currentPage.keyboard.press(params.key)

    return {
      content: [
        {
          type: 'text',
          text: `Pressed key: ${params.key}`
        }
      ]
    }
  }

  async fillForm(params: {
    fields: Array<{ name: string; type: string; ref: string; value: string }>
  }) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    const results = []

    for (const field of params.fields) {
      const selector = this.elementRefMap.get(field.ref)
      if (!selector) {
        throw new Error(`Element reference ${field.ref} not found for field ${field.name}`)
      }

      if (field.type === 'checkbox') {
        const isChecked = field.value === 'true'
        await this.currentPage.setChecked(selector, isChecked)
        results.push(`${field.name}: ${isChecked ? 'checked' : 'unchecked'}`)
      } else {
        await this.currentPage.fill(selector, field.value)
        results.push(`${field.name}: "${field.value}"`)
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Filled form fields:\n${results.join('\n')}`
        }
      ]
    }
  }

  async selectOption(params: { element: string; ref: string; values: string[] }) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    const selector = this.elementRefMap.get(params.ref)
    if (!selector) {
      throw new Error(`Element reference ${params.ref} not found`)
    }

    await this.currentPage.selectOption(selector, params.values)

    return {
      content: [
        {
          type: 'text',
          text: `Selected options in ${params.element}: ${params.values.join(', ')}`
        }
      ]
    }
  }

  async hover(params: { element: string; ref: string }) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    const selector = this.elementRefMap.get(params.ref)
    if (!selector) {
      throw new Error(`Element reference ${params.ref} not found`)
    }

    await this.currentPage.hover(selector)

    return {
      content: [
        {
          type: 'text',
          text: `Hovered over ${params.element} (ref: ${params.ref})`
        }
      ]
    }
  }

  async drag(params: {
    startElement: string
    startRef: string
    endElement: string
    endRef: string
  }) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    const startSelector = this.elementRefMap.get(params.startRef)
    const endSelector = this.elementRefMap.get(params.endRef)

    if (!startSelector) {
      throw new Error(`Start element reference ${params.startRef} not found`)
    }
    if (!endSelector) {
      throw new Error(`End element reference ${params.endRef} not found`)
    }

    await this.currentPage.dragAndDrop(startSelector, endSelector)

    return {
      content: [
        {
          type: 'text',
          text: `Dragged ${params.startElement} to ${params.endElement}`
        }
      ]
    }
  }

  async snapshot() {
    if (!this.currentPage) throw new Error('Browser not initialized')

    // Clear previous element mappings
    this.elementRefMap.clear()
    this.refCounter = 100

    const elements = await this.currentPage.evaluate(() => {
      const elements: ElementSnapshotWithSelector[] = []
      let refCounter = 100

      function getSelector(el: Element): string {
        // Try to build a unique selector
        if (el.id) return `#${el.id}`

        const tagName = el.tagName.toLowerCase()
        let selector = tagName

        if (el.className) {
          const classes = el.className.split(' ').filter((c) => c.trim())
          if (classes.length > 0) {
            selector += '.' + classes.join('.')
          }
        }

        // Add attribute selectors for uniqueness
        const attrs = ['name', 'type', 'placeholder', 'aria-label']
        for (const attr of attrs) {
          const value = el.getAttribute(attr)
          if (value) {
            selector += `[${attr}="${value}"]`
            break
          }
        }

        return selector
      }

      function processElement(el: Element, depth = 0): void {
        const tagName = el.tagName.toLowerCase()
        const text = el.textContent?.trim().substring(0, 100) || ''
        const role = el.getAttribute('role') || (el as HTMLInputElement).type || tagName

        // Include interactive elements and elements with text
        if (
          text ||
          [
            'button',
            'input',
            'select',
            'textarea',
            'a',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'label',
            'option'
          ].includes(tagName)
        ) {
          const ref = `e${refCounter++}`
          const selector = getSelector(el)

          elements.push({
            ref,
            role,
            name: text,
            tag: tagName,
            depth,
            clickable:
              ['button', 'a', 'input', 'select', 'textarea'].includes(tagName) ||
              el.getAttribute('onclick') !== null ||
              el.getAttribute('role') === 'button',
            type: (el as HTMLInputElement).type || undefined,
            value: (el as HTMLInputElement).value || undefined,
            selector,
            attributes: {
              id: el.id || undefined,
              className: el.className || undefined,
              name: el.getAttribute('name') || undefined,
              placeholder: el.getAttribute('placeholder') || undefined
            }
          })
        }

        // Process children
        Array.from(el.children).forEach((child) => processElement(child, depth + 1))
      }

      if (document.body) {
        processElement(document.body)
      }

      return elements
    })

    // Build element reference map
    elements.forEach((element: ElementSnapshot & { selector: string }) => {
      this.elementRefMap.set(element.ref, element.selector)
    })

    // Format as YAML-like structure
    let yamlOutput = 'page:\n'
    yamlOutput += `  url: ${this.currentPage.url()}\n`
    yamlOutput += `  title: ${await this.currentPage.title()}\n`
    yamlOutput += '  elements:\n'

    elements.forEach((element: ElementSnapshot) => {
      const indent = '  '.repeat(element.depth + 2)
      yamlOutput += `${indent}- ref: ${element.ref}\n`
      yamlOutput += `${indent}  role: ${element.role}\n`
      yamlOutput += `${indent}  name: "${element.name}"\n`
      yamlOutput += `${indent}  tag: ${element.tag}\n`
      if (element.clickable) yamlOutput += `${indent}  clickable: true\n`
      if (element.type) yamlOutput += `${indent}  type: ${element.type}\n`
      if (element.value) yamlOutput += `${indent}  value: "${element.value}"\n`
    })

    return {
      content: [
        {
          type: 'text',
          text: `Page snapshot captured with ${elements.length} elements:\n\n${yamlOutput}`
        }
      ]
    }
  }

  async takeScreenshot(
    params: {
      filename?: string
      element?: string
      ref?: string
      fullPage?: boolean
      type?: string
    } = {}
  ) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = params.filename || `screenshot-${timestamp}.${params.type || 'png'}`
    const screenshotPath = join(this.screenshotDir, filename)

    const screenshotType: 'png' | 'jpeg' = params.type === 'jpeg' ? 'jpeg' : 'png'
    const options = {
      path: screenshotPath,
      fullPage: params.fullPage || false,
      type: screenshotType
    }

    if (params.element && params.ref) {
      const selector = this.elementRefMap.get(params.ref)
      if (!selector) {
        throw new Error(`Element reference ${params.ref} not found`)
      }
      const element = this.currentPage.locator(selector)
      await element.screenshot(options)
    } else {
      await this.currentPage.screenshot(options)
    }

    return {
      content: [
        {
          type: 'text',
          text: `Screenshot saved to: ${screenshotPath}`
        }
      ]
    }
  }

  async evaluate(params: { function: string; element?: string; ref?: string }) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    try {
      let result

      if (params.element && params.ref) {
        const selector = this.elementRefMap.get(params.ref)
        if (!selector) {
          throw new Error(`Element reference ${params.ref} not found`)
        }

        result = await this.currentPage.locator(selector).evaluate(params.function)
      } else {
        // Evaluate in page context
        const func = new Function('return ' + params.function)()
        result = await this.currentPage.evaluate(func)
      }

      return {
        content: [
          {
            type: 'text',
            text: `JavaScript evaluation result: ${JSON.stringify(result, null, 2)}`
          }
        ]
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`JavaScript evaluation failed: ${errorMessage}`)
    }
  }

  async fileUpload(params: { paths: string[] }) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    // Find file input elements
    const fileInputs = await this.currentPage.locator('input[type="file"]').all()

    if (fileInputs.length === 0) {
      throw new Error('No file input elements found on the page')
    }

    await fileInputs[0].setInputFiles(params.paths)

    return {
      content: [
        {
          type: 'text',
          text: `Uploaded files: ${params.paths.join(', ')}`
        }
      ]
    }
  }

  async manageTabs(params: { action: string; index?: number }) {
    if (!this.electronApp) throw new Error('Browser not initialized')

    switch (params.action) {
      case 'list': {
        const pages = this.electronApp.windows()
        return {
          content: [
            {
              type: 'text',
              text: `Open windows: ${pages.length}\nCurrent: ${this.pages.indexOf(this.currentPage!)}`
            }
          ]
        }
      }
      case 'new': {
        // In Electron, we work with windows, not tabs
        const newWindow = await this.electronApp.firstWindow()
        this.pages.push(newWindow)
        return {
          content: [
            {
              type: 'text',
              text: 'New window created'
            }
          ]
        }
      }
      case 'close': {
        if (params.index !== undefined && this.pages[params.index]) {
          await this.pages[params.index].close()
          this.pages.splice(params.index, 1)
        }
        return {
          content: [
            {
              type: 'text',
              text: `Closed window at index ${params.index}`
            }
          ]
        }
      }
      case 'select': {
        if (params.index !== undefined && this.pages[params.index]) {
          this.currentPage = this.pages[params.index]
          await this.currentPage.bringToFront()
        }
        return {
          content: [
            {
              type: 'text',
              text: `Switched to window at index ${params.index}`
            }
          ]
        }
      }
      default:
        throw new Error(`Unknown tab action: ${params.action}`)
    }
  }

  async handleDialog(params: { accept: boolean; promptText?: string }) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    // Set up dialog handler
    this.currentPage.once('dialog', async (dialog) => {
      if (params.accept) {
        await dialog.accept(params.promptText || '')
      } else {
        await dialog.dismiss()
      }
    })

    return {
      content: [
        {
          type: 'text',
          text: `Dialog handler set: ${params.accept ? 'accept' : 'dismiss'}`
        }
      ]
    }
  }

  async waitFor(params: { text?: string; textGone?: string; time?: number }) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    if (params.text) {
      await this.currentPage.waitForSelector(`text=${params.text}`, { timeout: 30000 })
      return {
        content: [
          {
            type: 'text',
            text: `Waited for text: "${params.text}"`
          }
        ]
      }
    }

    if (params.textGone) {
      await this.currentPage.waitForSelector(`text=${params.textGone}`, {
        state: 'detached',
        timeout: 30000
      })
      return {
        content: [
          {
            type: 'text',
            text: `Waited for text to disappear: "${params.textGone}"`
          }
        ]
      }
    }

    if (params.time) {
      await this.currentPage.waitForTimeout(params.time * 1000)
      return {
        content: [
          {
            type: 'text',
            text: `Waited for ${params.time} seconds`
          }
        ]
      }
    }

    throw new Error('No wait condition specified')
  }

  async resize(params: { width: number; height: number }) {
    if (!this.currentPage) throw new Error('Browser not initialized')

    await this.currentPage.setViewportSize({ width: params.width, height: params.height })

    return {
      content: [
        {
          type: 'text',
          text: `Resized browser to ${params.width}x${params.height}`
        }
      ]
    }
  }

  async close() {
    if (this.electronApp) {
      await this.electronApp.close()
      this.electronApp = null
      this.currentPage = null
      this.pages = []
    }

    return {
      content: [
        {
          type: 'text',
          text: 'Browser closed'
        }
      ]
    }
  }

  async getNetworkRequests() {
    return {
      content: [
        {
          type: 'text',
          text: `Network requests (${this.networkRequests.length}):\n${JSON.stringify(this.networkRequests, null, 2)}`
        }
      ]
    }
  }

  async getConsoleMessages() {
    return {
      content: [
        {
          type: 'text',
          text: `Console messages (${this.consoleMessages.length}):\n${JSON.stringify(this.consoleMessages, null, 2)}`
        }
      ]
    }
  }
}

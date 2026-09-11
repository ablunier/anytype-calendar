#!/usr/bin/env node
// Drives the Calendar for Anytype desktop app. `launch` starts the built app detached, with
// the Chrome DevTools Protocol on the renderer and the Node inspector on the main process;
// every other command connects, does one thing, prints, and exits. No dependencies: Node's
// global fetch and WebSocket (Node 22+) are enough.
//
//   node .claude/skills/run-desktop/driver.mjs <command> [args]     (from apps/desktop)
//
// Run with no command for the list.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UNIT = path.resolve(import.meta.dirname, '../../..')
const ROOT = path.resolve(UNIT, '../..')
const ELECTRON = path.join(ROOT, 'node_modules/electron/dist/electron')
const BUILT_MAIN = path.join(UNIT, 'out/main/index.js')

const STATE_DIR = process.env.RUN_DESKTOP_DIR ?? path.join(os.tmpdir(), 'run-desktop')
const SHOT_DIR = process.env.SCREENSHOT_DIR ?? path.join(STATE_DIR, 'shots')
const PID_FILE = path.join(STATE_DIR, 'electron.pid')
const LOG_FILE = path.join(STATE_DIR, 'electron.log')
const PAGE_PORT = Number(process.env.RUN_DESKTOP_PAGE_PORT ?? 9333)
const MAIN_PORT = Number(process.env.RUN_DESKTOP_MAIN_PORT ?? 9335)

/** The code InMemoryAuthGateway accepts under ANYTYPE_CALENDAR_FAKE_AUTH=1. */
const FAKE_CODE = '2749'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---- CDP plumbing -------------------------------------------------------------------------

async function targets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`)
  return response.json()
}

async function connect(port, pick) {
  let list
  try {
    list = await targets(port)
  } catch {
    throw new Error(`nothing listening on ${port} — run \`launch\` first`)
  }
  const target = list.find(pick)
  if (!target) throw new Error(`no matching target on ${port}: ${JSON.stringify(list)}`)
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let nextId = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const settle = pending.get(message.id)
    if (!settle) return
    pending.delete(message.id)
    settle(message)
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, (message) =>
        message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result)
      )
      ws.send(JSON.stringify({ id, method, params }))
    })
  return { send, close: () => ws.close() }
}

const page = () => connect(PAGE_PORT, (t) => t.type === 'page' && !t.url.startsWith('devtools://'))
const main = () => connect(MAIN_PORT, () => true)

/**
 * Evaluates an *expression*. It is wrapped in an async arrow so `const` never leaks into the
 * page's global scope — a second eval declaring the same name would otherwise throw.
 */
async function evaluate(session, expression) {
  const result = await session.send('Runtime.evaluate', {
    expression: `(async () => (${expression}))()`,
    awaitPromise: true,
    returnByValue: true
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  }
  return result.result.value
}

async function withPage(fn) {
  const session = await page()
  try {
    return await fn(session)
  } finally {
    session.close()
  }
}

const bodyText = (session) => evaluate(session, 'document.body.innerText')

async function waitForText(session, text, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await bodyText(session)).includes(text)) return true
    await sleep(100)
  }
  return false
}

const clickTextExpr = (text) => `(() => {
  const wanted = ${JSON.stringify(text)}
  const all = [...document.querySelectorAll('button, a, [role="button"]')]
  const el = all.find((e) => e.textContent.trim() === wanted) ?? all.find((e) => e.textContent.includes(wanted))
  if (!el) return 'NOT_FOUND'
  if (el.disabled) return 'DISABLED'
  el.click()
  return 'OK'
})()`

function print(value) {
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

// ---- process management -------------------------------------------------------------------

function runningPid() {
  if (!fs.existsSync(PID_FILE)) return null
  const pid = Number(fs.readFileSync(PID_FILE, 'utf8'))
  try {
    process.kill(pid, 0)
    return pid
  } catch {
    fs.rmSync(PID_FILE, { force: true })
    return null
  }
}

// ---- commands -----------------------------------------------------------------------------

const commands = {
  async launch(...flags) {
    const fake = flags.includes('--fake')
    if (!fs.existsSync(BUILT_MAIN)) throw new Error(`no build at ${BUILT_MAIN} — run \`npm run build\``)
    const existing = runningPid()
    if (existing) throw new Error(`already running (pid ${existing}) — \`quit\` first`)

    fs.mkdirSync(STATE_DIR, { recursive: true })
    const log = fs.openSync(LOG_FILE, 'w')
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    if (fake) env.ANYTYPE_CALENDAR_FAKE_AUTH = '1'
    else delete env.ANYTYPE_CALENDAR_FAKE_AUTH

    const child = spawn(
      ELECTRON,
      [`--inspect=${MAIN_PORT}`, UNIT, `--remote-debugging-port=${PAGE_PORT}`],
      { env, detached: true, stdio: ['ignore', log, log] }
    )
    child.unref()
    fs.writeFileSync(PID_FILE, String(child.pid))

    // Ready = the renderer has drawn something from main's first session snapshot.
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      if (!runningPid()) throw new Error(`electron exited during launch — see ${LOG_FILE}`)
      try {
        const text = await withPage(bodyText)
        if (text.trim()) {
          print(`launched pid ${child.pid} (${fake ? 'fake Anytype' : 'real Anytype'}), log ${LOG_FILE}`)
          return
        }
      } catch {
        // Not listening yet, or the page is still loading.
      }
      await sleep(250)
    }
    throw new Error(`no UI after 30s — see ${LOG_FILE}`)
  },

  async quit() {
    const pid = runningPid()
    if (!pid) return print('not running')
    process.kill(pid, 'SIGTERM')
    for (let i = 0; i < 40 && runningPid(); i++) await sleep(100)
    fs.rmSync(PID_FILE, { force: true })
    print(`stopped pid ${pid}`)
  },

  async ss(name = `ss-${Date.now()}`) {
    fs.mkdirSync(SHOT_DIR, { recursive: true })
    const file = path.join(SHOT_DIR, `${name}.png`)
    await withPage(async (session) => {
      // The window's own size; pins the capture so it doesn't depend on the desktop's scaling.
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 900,
        height: 670,
        deviceScaleFactor: 1,
        mobile: false
      })
      const { data } = await session.send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(file, Buffer.from(data, 'base64'))
    })
    print(`screenshot: ${file}`)
  },

  text: (selector) =>
    withPage(async (session) =>
      print(
        await evaluate(
          session,
          selector
            ? `document.querySelector(${JSON.stringify(selector)})?.innerText ?? '(no match)'`
            : 'document.body.innerText'
        )
      )
    ),

  eval: (...expression) => withPage(async (session) => print(await evaluate(session, expression.join(' ')))),

  'click-text': (...text) =>
    withPage(async (session) => print(await evaluate(session, clickTextExpr(text.join(' '))))),

  focus: (selector) =>
    withPage(async (session) =>
      print(
        await evaluate(
          session,
          `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return 'NOT_FOUND'; el.focus(); return 'OK' })()`
        )
      )
    ),

  type: (...text) =>
    withPage(async (session) => {
      await session.send('Input.insertText', { text: text.join(' ') })
      print('OK')
    }),

  'wait-text': (text, timeoutMs = '10000') =>
    withPage(async (session) => print((await waitForText(session, text, Number(timeoutMs))) ? 'found' : 'TIMEOUT')),

  /** Main's session and schema snapshots, as the renderer receives them. */
  state: () =>
    withPage(async (session) =>
      print(
        await evaluate(
          session,
          'Promise.all([window.api.session.get(), window.api.schema.get()]).then(([session, schema]) => ({ session, schema }))'
        )
      )
    ),

  /**
   * Start → code → verify in one process: the challenge lasts 60 s, so doing it across
   * separate commands with thinking in between lets it expire.
   */
  'sign-in-fake': () =>
    withPage(async (session) => {
      const current = await evaluate(session, 'window.api.session.get()')
      if (current.phase === 'connected') return print('already connected')
      if (current.phase !== 'awaiting-code') {
        await evaluate(session, 'window.api.auth.start()')
      }
      if (!(await waitForText(session, 'Verify'))) throw new Error('code screen never appeared')
      await evaluate(session, `document.querySelector('input[inputmode="numeric"]').focus()`)
      await session.send('Input.insertText', { text: FAKE_CODE })
      const clicked = await evaluate(session, clickTextExpr('Verify'))
      if (clicked !== 'OK') throw new Error(`Verify button: ${clicked}`)
      if (!(await waitForText(session, 'Connected to your account'))) {
        throw new Error(`not connected: ${(await bodyText(session)).slice(0, 200)}`)
      }
      print('connected (success card showing)')
    }),

  'sign-out': () =>
    withPage(async (session) => {
      await evaluate(session, 'window.api.auth.signOut()')
      print('signed out')
    }),

  /**
   * Evaluates an expression in the Electron main process. `process.mainModule.require`
   * reaches `electron` and Node core, e.g. `process.mainModule.require('electron').app.getPath('userData')`.
   */
  'main-eval': async (...expression) => {
    const session = await main()
    try {
      print(await evaluate(session, expression.join(' ')))
    } finally {
      session.close()
    }
  }
}

const [name, ...args] = process.argv.slice(2)
const command = commands[name]
if (!command) {
  console.log(`commands: ${Object.keys(commands).join(', ')}`)
  process.exit(name ? 1 : 0)
}
try {
  await command(...args)
} catch (error) {
  console.error(`ERROR: ${error.message}`)
  process.exit(1)
}

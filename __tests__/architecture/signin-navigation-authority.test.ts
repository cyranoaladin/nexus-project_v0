import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * `/auth/signin` is server-rendered behind `await auth()`: when it resolves a
 * live session it redirects to that role's dashboard instead of serving the
 * form. Auth.js re-issues the JWT cookie on the client-side
 * `/api/auth/session` refresh, so a refresh already on the wire from a previous
 * role's document can land its Set-Cookie AFTER the cookie jar was cleared. A
 * real CI trace showed the whole race inside 34ms (PR #285).
 *
 * No pre-check closes that window, because the check and the navigation cannot
 * be made atomic. `gotoSignInForm` (e2e/helpers/auth.ts) instead observes the
 * OUTCOME — if the navigation did not land on the form, it clears and retries,
 * bounded.
 *
 * This guard is deliberately narrow. A bare `page.goto('/auth/signin')` is
 * legitimate when no session can exist (a fresh Playwright context, the default
 * for every `test()`), and one spec navigates with `waitUntil: 'commit'` on
 * purpose to assert the inputs are still disabled before hydration. What is
 * NOT legitimate is clearing the session immediately before navigating: calling
 * `resetBrowserSession` right there is the author's own statement that a
 * session may still exist, which is exactly the case the race defeats.
 */

const E2E_ROOT = 'e2e'

function sourceFiles(directory: string): string[] {
  return readdirSync(resolve(process.cwd(), directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(relative)
    return /\.ts$/.test(entry.name) ? [relative] : []
  })
}

const RAW_SIGNIN_GOTO = /page\.goto\(\s*['"`]\/auth\/signin['"`]/

describe('sign-in navigation authority', () => {
  it('routes every session-clearing sign-in navigation through gotoSignInForm', () => {
    const offenders: string[] = []

    for (const file of sourceFiles(E2E_ROOT)) {
      // The helper itself IS the authority: its own `page.goto` is the retry.
      if (file === 'e2e/helpers/auth.ts') continue

      const lines = readFileSync(resolve(process.cwd(), file), 'utf8').split('\n')

      // Measure the look-back in CODE lines, not raw lines: an explanatory
      // comment between the clear and the navigation must not push the clear
      // out of the window and silently disarm this guard. (It did, on the
      // first draft of this very test — caught by mutation-checking it.)
      const code = lines
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(({ line }) => {
          const trimmed = line.trim()
          return trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')
        })

      code.forEach(({ line, lineNumber }, index) => {
        if (!RAW_SIGNIN_GOTO.test(line)) return
        const window = code.slice(Math.max(0, index - 3), index).map((entry) => entry.line).join('\n')
        if (/resetBrowserSession\s*\(/.test(window)) {
          offenders.push(`${file}:${lineNumber}`)
        }
      })
    }

    expect(offenders).toEqual([])
  })

  it('keeps gotoSignInForm observing the outcome rather than pre-checking', () => {
    const helper = readFileSync(resolve(process.cwd(), 'e2e/helpers/auth.ts'), 'utf8')
    expect(helper).toContain('export async function gotoSignInForm')

    // Scope every assertion to gotoSignInForm's OWN body. Matching
    // /gotoSignInForm[\s\S]*?resetBrowserSession/ against the whole file is
    // worthless: it is satisfied by any later function that happens to clear
    // the session. (The first draft did exactly that and survived having the
    // retry deleted — caught by mutation-checking it.)
    const body = /export async function gotoSignInForm[\s\S]*?\n\}/.exec(helper)?.[0]
    expect(body).toBeDefined()

    // It must re-read the landed URL, clear, and retry — not navigate once.
    expect(body).toMatch(/new URL\(page\.url\(\)\)/)
    expect(body).toMatch(/resetBrowserSession\(page\)/)
    expect(body).toMatch(/for \(/)
    expect(body).toMatch(/throw new Error\(/)
  })

  it('keeps the two call sites converged in PR #285 and its follow-up on the authority', () => {
    for (const file of [
      'e2e/helpers/golden-family.ts',
      'e2e/auth/parent-canonical-report-access.spec.ts',
      'e2e/auth/session-revocation.spec.ts',
    ]) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8')
      // The CALL, not merely the import: a reverted call site keeps the import.
      expect(source).toMatch(/await gotoSignInForm\(page\)/)
      expect(source).not.toMatch(RAW_SIGNIN_GOTO)
    }
  })
})

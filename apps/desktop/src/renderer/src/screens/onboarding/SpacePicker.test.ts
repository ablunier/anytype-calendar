import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('SpacePicker', () => {
  it('makes the whole space row a checkbox control so the name toggles selection', () => {
    const source = readFileSync(resolve(__dirname, 'SpacePicker.tsx'), 'utf8')
    expect(source).toMatch(/role=["']checkbox["']/)
    expect(source).toMatch(/aria-label=\{t\(['"]common\.showSpace['"]/)
    expect(source).toMatch(/onClick=\{\(\) => onToggle\(space\.key\)\}/)
    // Name stays inside the row control, not a detached span beside Checkbox.
    expect(source).toMatch(/\{space\.name\}/)
    expect(source).not.toMatch(/<Checkbox[\s\S]*ariaLabel=\{t\(['"]common\.showSpace['"]/)
  })
})

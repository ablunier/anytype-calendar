import type { ObjectType, Space } from '@renderer/types'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SpacePicker } from './SpacePicker'

// Static markup is all the node-only renderer project can render; a click-driven test
// belongs to the component suite of #28. A <label for> naming the input is what makes
// a click on the name toggle it in the browser.
const space = { key: 'work', name: 'Work space' } as Space

function render(selectedKeys: string[]): string {
  return renderToStaticMarkup(
    createElement(SpacePicker, { spaces: [space], types: [] as ObjectType[], selectedKeys, onToggle: () => {} }),
  )
}

describe('SpacePicker', () => {
  it('labels the space checkbox with the space name, so clicking the name toggles it', () => {
    const html = render([])
    const inputId = /<input id="([^"]+)" type="checkbox"/.exec(html)?.[1]
    expect(inputId).toBeDefined()
    expect(html).toMatch(new RegExp(`<label for="${inputId}"[^>]*>(?:(?!</label>).)*Work space`))
  })

  it('reflects the selection on the checkbox', () => {
    expect(render([])).not.toMatch(/<input [^>]*type="checkbox"[^>]* checked=/)
    expect(render(['work'])).toMatch(/<input [^>]*type="checkbox"[^>]* checked=/)
  })
})

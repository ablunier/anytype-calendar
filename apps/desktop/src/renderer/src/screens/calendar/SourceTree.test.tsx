import { renderWithI18n } from '@renderer/test/render'
import type { FeedSource, ObjectType, Space } from '@renderer/types'
import { screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FeedList, SourceTree } from './SourceTree'

const work: Space = { key: 'work', name: 'Work' }

function objectType(key: string, label: string): ObjectType {
  return {
    key,
    space: work.key,
    label,
    category: 'sage',
    icon: 'calendar',
    props: [],
    selects: [],
    checkboxes: [],
    texts: [],
    panelProps: [],
    from: 'dueDate',
    to: null,
    includesTime: false,
    colourBy: null,
    panel: [],
    done: null,
    location: null,
  }
}

const sources = [objectType('task', 'Task'), objectType('meeting', 'Meeting')]

function Harness({ initiallyHidden }: { initiallyHidden: string[] }): React.JSX.Element {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set(initiallyHidden))
  return (
    <SourceTree
      spaces={[work]}
      sources={sources}
      hidden={hidden}
      collapsedSpaces={new Set()}
      onSetShown={(keys, shown) =>
        setHidden((current) => {
          const next = new Set(current)
          for (const key of keys) shown ? next.delete(key) : next.add(key)
          return next
        })
      }
      onToggleSpaceCollapsed={() => {}}
    />
  )
}

describe('SourceTree', () => {
  it('draws each source as a checkbox named by what it does', () => {
    renderWithI18n(<Harness initiallyHidden={['meeting']} />)
    expect(screen.getByRole('checkbox', { name: 'Hide Task' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Show Meeting' })).not.toBeChecked()
  })

  it('marks a space with only some of its sources shown as indeterminate', () => {
    renderWithI18n(<Harness initiallyHidden={['meeting']} />)
    expect(screen.getByRole('checkbox', { name: 'Hide Work' })).toBePartiallyChecked()
  })

  it('toggles a source with Space', async () => {
    const { user } = renderWithI18n(<Harness initiallyHidden={[]} />)
    screen.getByRole('checkbox', { name: 'Hide Task' }).focus()
    await user.keyboard(' ')
    expect(screen.getByRole('checkbox', { name: 'Show Task' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Hide Work' })).toBePartiallyChecked()
  })

  it('hides every source of a space when its mixed toggle is pressed with Space', async () => {
    const { user } = renderWithI18n(<Harness initiallyHidden={['meeting']} />)
    screen.getByRole('checkbox', { name: 'Hide Work' }).focus()
    await user.keyboard(' ')
    const space = screen.getByRole('checkbox', { name: 'Show Work' })
    expect(space).not.toBeChecked()
    expect(space).not.toBePartiallyChecked()
    expect(screen.getByRole('checkbox', { name: 'Show Task' })).not.toBeChecked()

    await user.keyboard(' ')
    expect(screen.getByRole('checkbox', { name: 'Hide Work' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Hide Meeting' })).toBeChecked()
  })
})

describe('FeedList', () => {
  it('toggles a subscription with Space', async () => {
    const feed: FeedSource = {
      key: 'feed:holidays',
      id: 'holidays',
      name: 'Holidays',
      category: 'clay',
      colour: 'red',
      host: 'example.com',
      status: { state: 'synced' },
    }
    const onSetShown = vi.fn()
    const { user } = renderWithI18n(<FeedList feeds={[feed]} hidden={new Set()} onSetShown={onSetShown} />)
    screen.getByRole('checkbox', { name: 'Hide Holidays' }).focus()
    await user.keyboard(' ')
    expect(onSetShown).toHaveBeenCalledWith(['feed:holidays'], false)
  })
})

import { useState } from 'react'
import { IconButton } from '@renderer/components/ui'

export interface FlowFrame {
  id: string
  group: string
  label: string
}

export interface FlowSwitcherProps {
  frames: FlowFrame[]
  activeId: string
  theme: 'light' | 'dark'
  onSelect: (id: string) => void
  onToggleTheme: () => void
}

/**
 * A harness, not part of the design.
 *
 * The flow's ten frames are not all reachable by clicking through the product — an auth
 * error only appears after a failed exchange there is no backend to produce. This pins a
 * jump list to the corner so every frame can be opened directly, in either theme. It is
 * the first thing to delete once the screens are driven by real state.
 */
export function FlowSwitcher({
  frames,
  activeId,
  theme,
  onSelect,
  onToggleTheme
}: FlowSwitcherProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const groups = [...new Set(frames.map((frame) => frame.group))]

  return (
    /* data-harness marks this as not part of the design — screenshot tooling hides it. */
    <div
      data-harness
      className="fixed bottom-16 left-16 z-40 flex flex-col items-start gap-8"
    >
      {open ? (
        <nav
          aria-label="Screen flow"
          className="flex max-h-flow flex-col gap-12 overflow-auto rounded-card border border-line-subtle bg-surface-raised p-12 shadow-3"
        >
          <div className="flex items-center gap-8">
            <span className="type-overline text-micro text-ink-tertiary">Theme</span>
            <div className="flex-1" />
            <IconButton
              icon={theme === 'dark' ? 'sun' : 'moon'}
              label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              size="sm"
              variant="outline"
              onClick={onToggleTheme}
            />
          </div>
          {groups.map((group) => (
            <div key={group} className="flex flex-col gap-4">
              <span className="type-overline text-micro text-ink-tertiary">{group}</span>
              {frames
                .filter((frame) => frame.group === group)
                .map((frame) => (
                  <button
                    key={frame.id}
                    type="button"
                    onClick={() => onSelect(frame.id)}
                    aria-current={frame.id === activeId}
                    className={[
                      'rounded-6 px-8 py-4 text-left type-ui text-tiny transition-colors duration-fast',
                      frame.id === activeId
                        ? 'bg-surface-selected text-ink-accent'
                        : 'text-ink-body hover:bg-surface-hover'
                    ].join(' ')}
                  >
                    {frame.label}
                  </button>
                ))}
            </div>
          ))}
        </nav>
      ) : null}
      <IconButton
        icon={open ? 'x' : 'list'}
        label={open ? 'Hide screen flow' : 'Show screen flow'}
        variant="outline"
        active={open}
        onClick={() => setOpen(!open)}
      />
    </div>
  )
}

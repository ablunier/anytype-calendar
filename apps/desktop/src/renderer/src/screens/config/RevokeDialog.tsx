import { useState } from 'react'
import { Button, Dialog, Input } from '@renderer/components/ui'

export interface RevokeDialogProps {
  open: boolean
  spaceCount: number
  onClose: () => void
  onRevoke: () => void
}

const CONFIRM_WORD = 'revoke'

/** Typed confirmation, because deleting the key in Anytype cannot be undone. */
export function RevokeDialog({
  open,
  spaceCount,
  onClose,
  onRevoke
}: RevokeDialogProps): React.JSX.Element {
  const [typed, setTyped] = useState('')

  const consequences = [
    'Anytype stops accepting this key',
    `All ${spaceCount} spaces drop off the calendar`,
    'Your objects and dates are untouched'
  ]

  return (
    <Dialog
      open={open}
      width="wide"
      title="Revoke this API key?"
      description="The key is deleted in Anytype and this computer is signed out. Reconnecting means requesting a new 4-digit code."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            iconLeft="trash"
            disabled={typed !== CONFIRM_WORD}
            onClick={onRevoke}
          >
            Revoke key
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-12">
        <ul className="flex list-none flex-col gap-6 rounded-8 bg-surface-sunken p-12">
          {consequences.map((line) => (
            <li key={line} className="flex items-center gap-8 type-caption text-tiny text-ink-body">
              <span aria-hidden className="size-4 rounded-pill bg-stone-400" />
              {line}
            </li>
          ))}
        </ul>
        <Input
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={typed}
          onChange={setTyped}
          placeholder={CONFIRM_WORD}
          mono
        />
      </div>
    </Dialog>
  )
}

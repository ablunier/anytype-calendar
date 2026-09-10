import { Button } from '../../../components/ui'
import { AuthHead } from '../AuthShell'

const STEPS = [
  'Open the Anytype desktop app',
  'Start the connection below',
  'Type the 4-digit code Anytype shows you'
]

export interface AuthStartProps {
  onStart: () => void
}

/** (a) Idle — what the user has to do before a code exists. */
export function AuthStart({ onStart }: AuthStartProps): React.JSX.Element {
  return (
    <>
      <AuthHead
        icon="unplug"
        title="Connect to Anytype"
        body="Open Anytype on this computer and leave it running. One key connects your whole account — every space you own — and the calendar reads through the local app."
      />
      <ol className="mb-20 flex list-none flex-col gap-8 p-0">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-8 type-ui text-small text-ink-body">
            <span className="w-18 type-numeral text-micro text-ink-tertiary">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <Button variant="primary" size="lg" fullWidth iconLeft="link" onClick={onStart}>
        Start connection
      </Button>
    </>
  )
}

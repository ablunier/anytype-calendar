/** The brand is set in type — there is no logo. */
export function Wordmark(): React.JSX.Element {
  return (
    <span className="whitespace-nowrap font-display text-base tracking-heading text-ink-primary">
      <strong className="font-semibold">Calendar</strong>{' '}
      <span className="font-regular text-ink-tertiary">for Anytype</span>
    </span>
  )
}

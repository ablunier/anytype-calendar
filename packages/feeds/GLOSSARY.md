# Feeds

External calendars the user subscribes to by their iCalendar address, whose events the calendar shows read-only.

## Language

**Subscription**:
The user's standing choice to show an external calendar on theirs: its name, its address, its colour and its place in their order. It outlives its Feed: while the address fails, the last good Read stays drawn. No two Subscriptions share an address. The user calls it a subscribed calendar.
_Avoid_: feed, calendar (on their own, for a Subscription)

**Feed**:
What a Subscription's address serves: an iCalendar document holding Feed events. The name it gives itself only suggests the Subscription's name when the user leaves it empty.
_Avoid_: ICS file, calendar

**Read**:
One attempt to fetch and understand a Subscription's Feed. It succeeds or fails with a reason; a failed Read leaves the last good one drawn.
_Avoid_: sync, refresh (for one attempt)

**Feed event**:
An event of a Feed, as the Feed defines it: one meeting, which may recur. It is an Event, and never editable here.
_Avoid_: VEVENT, entry

**Occurrence**:
One time a Feed event happens. A Feed event that does not recur has exactly one; the calendar draws each Occurrence where it falls.
_Avoid_: instance, recurrence, event (for one time a recurring event happens)

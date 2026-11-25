# Feeds

External calendars the user subscribes to by their iCalendar address, whose events the calendar shows read-only.

## Language

**Feed event**:
An event of a subscribed calendar, as that calendar defines it: one meeting, which may recur. It is an Event, and never editable here.
_Avoid_: VEVENT, entry

**Occurrence**:
One time a Feed event happens. A Feed event that does not recur has exactly one; the calendar draws each Occurrence where it falls.
_Avoid_: instance, recurrence, event (for one time a recurring event happens)

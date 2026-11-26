# Events

The user's Anytype objects placed on the calendar by their dates, and the edits made to them from it.

## Language

**Dated object**:
An Anytype object the calendar draws as an Event, placed by the From and To of a Source that brings it. It is one Event however many Sources bring it, placed by the first shown one, a type before a Query; one with only a From date is still a Dated object, on that day or moment.
_Avoid_: event (say Event only for both kinds together), deadline (reserved for a possible future kind of Event)

**Span**:
What the calendar shows at once: one month, one week, one day or one agenda. A month Span is exactly that month; the neighbouring days its grid shows are padding, not part of it.
_Avoid_: period, range, window

**Calendar view**:
The kind of Span the user picked: Month, Week, Day or Agenda. Stepping back or on moves by one Span of that kind.
_Avoid_: mode, layout, view (a query has views of its own)

**Agenda**:
A Span of a chosen number of whole weeks from a given day, listed day by day. It steps by its own length.
_Avoid_: list view, schedule

# Glossary Map

## Contexts

- [Schema](./packages/schema/GLOSSARY.md): what the user puts on the calendar from their Anytype data, and how it is drawn
- [Events](./packages/events/GLOSSARY.md): the user's Anytype objects placed on the calendar by their dates
- [Feeds](./packages/feeds/GLOSSARY.md): external calendars the user subscribes to, shown read-only

## Shared language

**Calendar**:
The user's calendar in this app, on which every Event is drawn. Never one external calendar on its own: that is a Subscription.

**Event**:
Anything the calendar draws at a time: a Dated object (Events) or a Feed event (Feeds). It is the user's word, and names the two kinds together.
_Avoid_: item, entry

**Window**:
A stretch of time Events are read for. It covers at least the Span on screen, and may reach past it so the grid's padding days are filled too.
_Avoid_: range, visible range, span (for the time read)

**Hidden**:
A Source or Subscription the user turned off in the sidebar. It stays in the Selection, or subscribed, and is only not drawn.
_Avoid_: unselected, removed, disabled

## Relationships

- **Schema → Events**: Events draws the objects of the Selection's Sources; neither imports the other.
- **Events ↔ Feeds**: neither knows the other; the calendar draws their Events side by side.

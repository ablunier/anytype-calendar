# Glossary Map

## Contexts

- [Events](./packages/events/GLOSSARY.md): the user's Anytype objects placed on the calendar by their dates
- [Feeds](./packages/feeds/GLOSSARY.md): external calendars the user subscribes to, shown read-only

## Shared language

**Event**:
Anything the calendar draws at a time: a Dated object (Events) or a Feed event (Feeds). It is the user's word, and names the two kinds together.
_Avoid_: item, entry

## Relationships

- **Events ↔ Feeds**: neither knows the other; the calendar draws their Events side by side.

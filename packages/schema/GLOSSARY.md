# Schema

What the user puts on the calendar from their Anytype data, and how its objects are drawn.

## Language

**Selection**:
The user's saved answer to what goes on the calendar: the spaces they chose, and the Sources in them. Only the Sources of chosen spaces are on the calendar; a chosen space with none draws nothing.
_Avoid_: picks, settings, schema

**Source**:
One dated type or one Query the user put on the calendar, with how its objects are drawn: their From and To, whether those carry a time, what colours them and what the detail panel shows. The same type in two spaces is two Sources.
_Avoid_: choice, pick, type (when a Query may be meant), calendar

**Dated type**:
An Anytype type with a date property of the user's, its own or one its templates show. Only a dated type, or a Query over one, can be a Source.
_Avoid_: event type

**Query**:
An Anytype query over one dated type, read through one of its views: the first, unless the user picks another. Its objects are placed by its type's dates.
_Avoid_: set, view (for the query itself)

**From / To**:
The date properties a Source places its objects by. Without a To, each object sits on its From alone.
_Avoid_: start and end property, date mapping

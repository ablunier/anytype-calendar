// Public surface of the auth context's domain layer: @anytype-calendar/auth/domain.
//
// The pure center of the context — no other layer, no other context, no npm runtime deps,
// no Node core modules. `npm run lint:arch` enforces the imports; the context's
// `types: []` keeps platform globals out of scope.
//
// Grouped by role: ./model (entities, value objects and the pure functions on them),
// ./gateways (ports to external systems), ./repositories (persistence ports). Re-export
// from here as they are filled in.

export {}

// The Anytype local API transport shared by every context's Anytype adapters. Not a
// bounded context: it imports nothing outside itself, and `fetch` is injected.

export * from './http/anytype-client'

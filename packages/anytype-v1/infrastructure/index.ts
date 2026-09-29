// What the app still needs of Anytype's local API v1, which @ablunier/anytype-client does not
// serve, and the probe that picks v1 or v2 per key. Not a bounded context: it imports only that
// client. Dropping v1 means deleting this package and each context's v1 gateway.

export * from './anytype-dialect'
export * from './anytype-v1-client'

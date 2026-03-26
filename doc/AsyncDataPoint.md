# AsyncDataPoint

A lightweight async data management class that wraps a `get`/`set` function pair and handles caching, deduplication, optimistic updates, debouncing, retries, and change notification.

## What it does

### Caching & TTL
The getter result is cached for `ttl` milliseconds (default 5000). While the cache is valid, `get()` returns the same promise without triggering a new fetch. After expiry, the next `get()` re-fetches.

### Request Deduplication
While a getter is already pending, `get()` returns the same in-flight promise — no duplicate requests.

### Optimistic Updates
While a `set()` is in flight, `get()` immediately returns the expected (new) value without waiting for the server to confirm. Disable with `optimistic: false` to wait for confirmation instead.

### Debouncing
`set()` calls are delayed by `debounceMs` (default 5ms). Rapid consecutive sets within that window are coalesced into one request.

### Abort on Supersede
If a new `set()` arrives while a previous one is still pending, the previous request is aborted before the new one starts.

### No-op Detection
- `set()` with a value identical to the current cached value → silently ignored (returns `undefined`)
- `set()` with the same value as the already-pending setter → returns the existing setter promise

### Retry with Exponential Backoff
Both getter and setter support configurable retry counts and base delays. Failed attempts are retried with exponentially increasing wait times.

### Change Notification
`onchange({ value, oldValue })` fires when the resolved value actually changes (deep equality check). On error, `onchange({ error })` fires instead. No false positives from identical values.

### Transparent Promises
All internal promises expose `.state` (`'pending'` | `'fulfilled'` | `'rejected'`), `.value`, and `.reason` — readable synchronously without `await`.

### Local / External Updates
- `setLocal(value)` — injects a value as if it came from the server, bypassing the setter (e.g. pushed from WebSocket)
- `setFromPromise(promise)` — same, but from a live promise

### Cleanup
`dispose()` aborts all pending requests, clears timers, and removes references.

## Options

| Option | Default | Description |
|---|---|---|
| `ttl` | `5000` | Cache duration in ms |
| `optimistic` | `true` | Return expected value during pending set |
| `debounceMs` | `5` | Setter debounce window in ms |
| `getRetry` | `1` | Getter retry attempts |
| `getRetryDelay` | `500` | Getter base retry delay in ms |
| `setRetry` | `0` | Setter retry attempts |
| `setRetryDelay` | `500` | Setter base retry delay in ms |

## Usage

```js
const datapoint = new AsyncDataPoint({
    get: () => fetch('/api/item').then(r => r.json()),
    set: value => fetch('/api/item', { method: 'PUT', body: JSON.stringify(value) })
});

datapoint.onchange = ({ value }) => console.log('changed', value);

const value = await datapoint.get();
datapoint.set({ title: 'updated' });
```
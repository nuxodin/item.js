export interface AsyncDataPointOptions {
    /** While a write runs, reads already return the new value — though the source may still reject it. Default true. */
    optimistic?: boolean;
    /** How long a read value stays cached, in ms. 0 = forever. Default 5000. */
    ttl?: number;
    /** Writes within this time collapse into the last one, in ms. Default 5. */
    debounceMs?: number;
    /** Retries after a failed read (0 = a single attempt). Default 1. */
    getRetry?: number;
    /** Delay before the first retry in ms, doubles with every attempt. Default 500. */
    getRetryDelay?: number;
    /** Retries after a failed write. Default 0. */
    setRetry?: number;
    /** Default 500, see getRetryDelay. */
    setRetryDelay?: number;
    [key: string]: any;
}

export interface AsyncDataPointConfig<T = any> {
    get: (signal?: AbortSignal) => Promise<T>;
    set?: (value: T, signal?: AbortSignal) => Promise<T>;
}

export interface AsyncDataPointChangeEvent<T = any> {
    value?: T;
    oldValue?: T;
    error?: Error;
}

export interface ResolvedAsyncDataPointOptions extends Required<AsyncDataPointOptions> {}

/**
 * One remote value with one getter and one setter: caches reads, debounces writes and runs them one at a time.
 * @example
 * const point = new AsyncDataPoint({
 *     get: () => fetch(url).then(res => res.json()),
 *     set: value => fetch(url, { method: 'PUT', body: JSON.stringify(value) }),
 *     ttl: 10000,
 * });
 * point.onchange = ({ value, error }) => console.log(value, error);
 * await point.get();
 * await point.set({ title: 'foo' });
 */
export class AsyncDataPoint<T = any> {
    options: ResolvedAsyncDataPointOptions;

    createGetter: (signal?: AbortSignal) => Promise<T>;
    createSetter: ((value: T, signal?: AbortSignal) => Promise<T>) | undefined;

    onpending: (() => void) | null;
    onchange: ((event: AsyncDataPointChangeEvent<T>) => void) | null;

    constructor(config: AsyncDataPointConfig<T> & AsyncDataPointOptions);

    get isPending(): boolean;
    /** True once a full value has arrived — via getter, setLocal, setFromPromise or a landed write. Expires with ttl. */
    get isLoaded(): boolean;
    get lastError(): Error | undefined;
    get recentValue(): T | undefined;

    /** Cached while ttl lasts. While a write runs: the value being written (optimistic), else the read after it landed. */
    get(): Promise<T>;
    /** Resolves once this value — or a newer one that overtook it — is saved. Returns undefined if it already is the loaded value. */
    set(value: T): Promise<T> | undefined;
    /** Caches a value that came from the source through another channel, without writing it. */
    setLocal(value: T): void;
    /** Like setLocal, for a value still on its way. */
    setFromPromise(promise: Promise<T>): void;
    dispose(): void;
    getDebugState(): {
        getter: Promise<T> | null;
        setter: Promise<T> | null;
        expectedValue: T | null;
    };
}
export interface AsyncDataPointOptions {
    optimistic?: boolean;
    ttl?: number;
    debounceMs?: number;
    getRetry?: number;
    getRetryDelay?: number;
    setRetry?: number;
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

    get(): Promise<T>;
    set(value: T): Promise<T> | undefined;
    setLocal(value: T): void;
    setFromPromise(promise: Promise<T>): void;
    dispose(): void;
    getDebugState(): {
        getter: Promise<T> | null;
        setter: Promise<T> | null;
        expectedValue: T | null;
    };
}
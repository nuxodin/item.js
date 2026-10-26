    /*
    // Usage:
    const datapoint = new AsyncDataPoint({
        get: () => fetch('https://example.com/todos/1').then(res => res.json()),
        set: value => fetch('https://example.com/todos/1', {method: 'PUT', body: JSON.stringify(value)}).then(res => res.json())
    });
    datapoint.set({title: 'foo', completed: true}); // Returns promise - or undefined if value is already the same - do not rely on return value
    // a write overtaken by a newer one settles as that one does: "this value or a newer one is saved"
    datapoint.get().then(value => console.log(value));

    // API
    datapoint.onchange = ({value}) => console.log('value changed', value);
    // options, passed to the constructor (or changed in datapoint.options):
    //   ttl: 5000 (cache in ms), debounceMs: 5 (setter delay), getRetry / setRetry, getRetryDelay / setRetryDelay,
    //   optimistic: true (until the sending is done, the value is the new one, though the server may fail)
    datapoint.setLocal({title: 'foo', completed: true}); // set value without saving it to the master (the value comes from the master through an other channel / trusted source)
    */

    export class AsyncDataPoint {

        createGetter;
        createSetter;
        #expectedValue = null; // value while saving
        #setter = null; // current setter promise
        #writing = Promise.resolve(); // the write running, the next one starts after it
        #getter = null; // current/cached getter promise
        #getterExpiry = Infinity; // ttl is checked lazily on access — no timer per cache entry
        // expired getters count as gone (lazy ttl)
        get #cachedGetter() {
            const g = this.#getter;
            return g && (this.#getterExpiry === Infinity || Date.now() < this.#getterExpiry) ? g : null;
        }
        onpending = null;
        onchange = null;
        
        constructor({get, set, ...options}) {
            this.options = {
                optimistic: true,
                ttl: 5000,
                debounceMs: 5,
                getRetry: 1,
                getRetryDelay: 500,
                setRetry: 0,
                setRetryDelay: 500,
                ...options
            };
            this.createGetter = get;
            this.createSetter = set;
        }

        #createGetter() {
            const {getRetry, getRetryDelay} = this.options;
            const controller = new AbortController();
            const promise = retryAsync(
                () => this.createGetter(controller.signal),
                getRetry, 
                getRetryDelay
            );
            promise.controller = controller;
            makePromiseTransparent(promise);
            return promise;
        }

        #createSetter(value) {
            const {setRetry, setRetryDelay, debounceMs} = this.options;        
            const promise = abortablePromise((resolve, reject) => {
                const {signal} = promise.controller;
                // one write at a time: a slow one landing last would leave the remote with an old value
                const run = this.#writing.then(() => signal.aborted || retryAsync(
                    () => this.createSetter(value, signal),
                    setRetry,
                    setRetryDelay
                ));
                this.#writing = run.catch(() => {});
                run.then(resolve, reject);
            }, debounceMs);
            
            makePromiseTransparent(promise);
            return promise;
        }

        #cacheGetter(promise){
            // trigger onchange if the value changes
            // note: triggers also if the getter is no more cached as we dont know if the value has changed

            if (promise.state === 'pending') this.onpending?.();

            const oldValue = this.#getter?.value;
            promise.then(
                value => {
                    if (this.#getter !== promise) return;
                    if (!isEqual(oldValue, value)) this.#notify({value, oldValue});
                },
                error => {
                    if (this.#getter !== promise) return;
                    if (error?.name === 'AbortError') return;
                    this.#notify({error, oldValue});
                }
            );

            this.#getter = promise;
            const duration = this.options.ttl;
            this.#getterExpiry = duration > 0 ? Date.now() + duration : Infinity;
        }

        #notify(event) {
            try { this.onchange?.(event); }
            catch (err) { console.error('[item.js] AsyncDataPoint onchange error:', err); }
        }

        setLocal(value) { this.#cacheGetter(transparentPromiseResolve(value)); }
        setFromPromise(promise) { this.#cacheGetter(makePromiseTransparent(promise)); }
        get isPending() { return this.#cachedGetter?.state === 'pending' || this.#setter?.state === 'pending'; }
        /** True once a full value has arrived — via getter, setLocal, setFromPromise or a landed write. */
        get isLoaded() { return this.#cachedGetter?.state === 'fulfilled'; }
        get lastError() { return this.#cachedGetter?.reason ?? this.#setter?.reason ?? undefined; }
        get recentValue() { return this.#cachedGetter?.value; }

        get() {
            if (this.#setter?.state === 'pending') {
                if (this.options.optimistic) {
                    return Promise.resolve(this.#expectedValue); // trust sending value
                } else {
                    return this.#setter.then(() => this.get()); // wait for setter to be done
                }
            }
            if (!this.#cachedGetter) this.#cacheGetter(this.#createGetter());
            return this.#getter;
        }

        set(value) {
            const previous = this.#setter, writing = previous?.state === 'pending';
            // Already setting this value
            if (writing && isEqual(this.#expectedValue, value)) return previous;

            // Value already set (no-op). Returns undefined to avoid falsy issues (value could be 0, false, etc.)
            // While a write runs the loaded value is outdated: setting it back is a change.
            const cached = this.#cachedGetter;
            if (!writing && cached?.state === 'fulfilled' && isEqual(cached.value, value)) return;
            
            this.#expectedValue = value;
            const promise = this.#createSetter(value);
            previous?.controller.abort(promise); // the previous one settles as this one does
            
            this.onpending?.();

            promise.then(
                data  => {
                    if (this.#setter !== promise) return;
                    this.setLocal(value);
                    this.#setter = null;
                    this.#expectedValue = null;
                },
                error => { // the failed setter stays: lastError reports it until the next write
                    if (this.#setter !== promise) return;
                    if (error?.name === 'AbortError') return;
                    this.#getter = null;
                    this.#expectedValue = null;
                    this.#notify({ error }); }
            );

            return this.#setter = promise;
        }

        dispose() {
            this.#setter?.controller.abort();
            this.#getter?.controller?.abort();
            this.#setter = null;
            this.#getter = null;
            this.#expectedValue = null;
            this.#getterExpiry = Infinity;
            this.onchange = null;
        }
        getDebugState() {
            return {
                getter: this.#getter,
                setter: this.#setter,
                expectedValue: this.#expectedValue
            };
        }

    }



    /**
     * Adds state and value properties to a Promise, making it transparent.
     * @param {Promise<any>|TransparentPromise} promise - The Promise to make transparent.
     * @returns {TransparentPromise} - The transparent Promise.
     * @example
     * const promise = makePromiseTransparent(new Promise(resolve => resolve('foo')));
     * promise.state; // 'pending'
     * promise.value; // undefined
     * promise.then(value => {
     *      console.log(promise.state); // 'fulfilled'
     *      console.log(promise.value); // 'foo'
     * });
     */
    function makePromiseTransparent(promise) {
        if (promise.state) console.warn('[item.js] already transparent');
        promise.state = 'pending'; // or 'unknown' ?
        promise.value = undefined;
        promise.then(
            value => {
                promise.state = 'fulfilled';
                promise.value = value;
            },
            reason => {
                promise.state = 'rejected';
                promise.reason = reason;
            }
        );
        return promise;
    }


    /**
     * Returns a transparent Promise (see makePromiseTransparent) that is resolved with the specified value.
     * @param {any} value - The value to resolve the Promise with.
     * @returns {TransparentPromise} - A transparent Promise.
     */
    function transparentPromiseResolve(value) {
        const promise = makePromiseTransparent(Promise.resolve(value));
        promise.state = 'fulfilled';
        promise.value = value;
        return promise;
    }

    /**
     * Returns a delayed Promise that can be aborted. Aborted with a promise as reason, it settles as
     * that one does (a newer write taking over), else it rejects with the AbortError.
     * @param {Function} fn - Called with (resolve, reject) after the delay.
     * @param {Number} [ms=1] - The time in milliseconds to delay before calling fn.
     * @returns {Promise<any>} - A delayed Promise that can be aborted.
     */
    function abortablePromise(fn, ms=1) { // delayed and therfore abortable within ms
        const controller = new AbortController();
        const {signal} = controller;
        const promise = new Promise((resolve, reject) => {
            const settle = (ok) => (v) => {
                if (!signal.aborted) return ok(v);
                signal.reason?.then ? resolve(signal.reason) : reject(signal.reason);
            };
            setTimeout(() => signal.aborted ? settle()() : fn(settle(resolve), settle(reject)), ms);
        });
        promise.controller = controller;
        return promise;
    }

    /**
     * Retries an async operation with exponential backoff.
     * @param {Function} fn - The async function to retry.
     * @param {Number} retries - Number of retries (0 = no retry, just one attempt).
     * @param {Number} baseDelay - Base delay in milliseconds for exponential backoff.
     * @returns {Promise<any>} - The result of the operation.
     */
    async function retryAsync(fn, retries = 2, baseDelay = 1000) {
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (error?.name === 'AbortError') return;
                lastError = error;
                if (attempt < retries) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    console.warn(`[item.js] Attempt ${attempt + 1}/${retries + 1} failed, retrying in ${delay}ms...`, error);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError;
    }


    /**
     * Compares two values for equality.
     * @param {any} a - The first value to compare.
     * @param {any} b - The second value to compare.
     * @returns {boolean} - True if the values are equal, false otherwise.
     */
    function isEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
        if (a.constructor !== b.constructor) return false;

        const keysA = Object.keys(a), keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;

        return keysA.every(k => Object.hasOwn(b, k) && isEqual(a[k], b[k]));
    }
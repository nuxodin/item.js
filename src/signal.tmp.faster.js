// signal / effect
const EFFECTS = Symbol();
let activeEffect = null;
let queue = null;

export function effect(fn) {
    const parent = activeEffect;
    if (parent) {
        (parent.nested ??= new Set()).add(fn);
        if (fn.parent && fn.parent !== parent) throw new Error("effect(cb) callbacks should not be reused for other effects");
        fn.parent = parent;
    }
    activeEffect = fn;
    cleanup(fn);
    try {
        fn({ self: fn });
    } finally {
        activeEffect = parent;
    }
    return () => dispose(fn);
}

function cleanup(effect) {
    const deps = effect.deps;
    if (!deps) return;
    for (const signal of deps) {
        signal[EFFECTS].delete(effect);
    }
    effect.deps = null;
}

function dispose(effect) {
    if (effect.disposed) return;
    effect.disposed = true;
    effect.nested?.forEach(dispose);
    effect.nested?.clear();
    effect.parent?.nested?.delete(effect);
    effect.parent = undefined;
}

function batch(effect) {
    if (queue) return queue.add(effect);
    queue = new Set([effect]);
    queueMicrotask(() => {
        for (const fn of queue) {
            if (fn.disposed) continue;
            if (queue.has(fn.parent)) continue;
            cleanup(fn);
            activeEffect = fn;
            try {
                fn({ self: fn });
            } catch (err) {
                console.error(err);
            }
        }
        activeEffect = null;
        queue = null;
    });
}

export function track(signal) {
    if (!activeEffect || activeEffect.disposed) return;
    (signal[EFFECTS] ??= new Set()).add(activeEffect);
    (activeEffect.deps ??= new Set()).add(signal);
}

export function notify(signal) {
    const effects = signal[EFFECTS];
    if (!effects) return;
    for (const fn of effects) {
        fn.nested?.forEach(dispose);
        if (fn.disposed) effects.delete(fn);
        else batch(fn);
    }
}
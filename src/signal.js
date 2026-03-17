// @ts-check

/** @import {Item} from "../item.js" */

// signal / effect
// toto: better cleaning. state object instead of properties on the function?
const relatedEffects = new WeakMap();

/** @type {EffectFn|null} */
let activeEffect = null;
/** @type {Set<EffectFn>|null} */
let queue = null;


/**
 * @typedef {Object} EffectProps
 * @property {Set<Item>} [deps] - Items, von denen dieser Effekt abhängt
 * @property {Set<EffectFn>} [nested] - Verschachtelte Effekte
 * @property {EffectFn} [parent] - Der übergeordnete Effekt
 * @property {boolean} [disposed] - Ob der Effekt gestoppt wurde
 * * @typedef {((args: {self: EffectFn}) => void) & EffectProps} EffectFn
 */

/**
 * Execute the provided function and re-execute it when dependencies change.
 * @param {EffectFn} fn - A function that executes immediately and collects the containing items.
 * @return {function} A function to dispose the effect.
 */
export function effect(fn) { // async?
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

/**
 * Notify all effects that depend on the given signal.
 * @param {Item} signal - The signal to notify.
 */
export function notify(signal) {
    const effects = relatedEffects.get(signal);
    if (!effects) return;
    for (const fn of effects) {
        fn.nested?.forEach(dispose);
        if (fn.disposed) effects.delete(fn);
        else batch(fn);
    }
}

/**
 * Register the active effect as a dependency of the given signal.
 * @param {Item} signal - The signal to track.
 */
export function track(signal) {
    if (!activeEffect || activeEffect.disposed) return;
    let effects = relatedEffects.get(signal);
    if (!effects) {
        effects = new Set();
        relatedEffects.set(signal, effects);
    }
    effects.add(activeEffect);
    
    (activeEffect.deps ??= new Set()).add(signal);
}

/**
 * Add an effect to the batch queue.
 * @param {EffectFn} effect - The effect to add.
 */
function batch(effect) {
    if (queue) return queue.add(effect); // currently collecting
    queue = new Set([effect]);
    queueMicrotask(() => {
        for (const fn of queue) {
            if (fn.disposed) continue;
            if (queue.has(fn?.parent)) continue; // skip if parent already runs. needed as nested effects are disposed anyway
            
            cleanup(fn);

            activeEffect = fn; // effect() called inside fn(callback) has to know his parent effect
            try {
                fn({ self: fn });
            } catch (err) {
                console.error(err);
            }
        }
        activeEffect = null;
        queue = null; // restart collecting, todo? we could also keep collecting while running, but it can cause infinite loops if not careful
    });
}

/**
 * @param {EffectFn} effect
 */
function cleanup(effect) {
    if (!effect.deps) return;
    for (const signal of effect.deps) {
        relatedEffects.get(signal)?.delete(effect);
    }
    effect.deps.clear();
}

/**
 * @param {EffectFn} effect
 */
function dispose(effect) {
    if (effect.disposed) return;
    effect.disposed = true;
    effect.nested?.forEach(dispose);
    effect.nested?.clear();
    effect.parent?.nested?.delete(effect); // remove from parent's nested set
    effect.parent = undefined;
}


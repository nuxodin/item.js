
const removedSymbol = Symbol('removed');

// An other variant would be to use structuralClone to clone the object and then compare it with the original
// This would probably use more memory on big objects but would be simpler, worth it?

export function collectChanges(item, onchange) {
    // items can be removed and then added again
    // so on remove we add a symbol to mark it as removed than can be overwritten by a new value

    // we need a wrapper to be able to have a reference even if the root value is not an object
    let wrapper = {};

    const startPathLevel = item.path.length-1;

    item.addEventListener('changeIn', e => {
        const {item, value, remove, add} = e.detail;
        if (add) return; // will be handled if the value is set (an other changeIn event)

        const relativePath = item.pathKeys.slice(startPathLevel);
        const path = ['changes', ...relativePath];
        const last = path.pop();

        let current = wrapper;
        for (const key of path) {
            if (!isObject(current[key])) current[key] = {};
            current = current[key];
        }
        if (remove) {
            current[last] ??= {};
            current[last][remove.key] = removedSymbol;
        } else {
            current[last] = value ?? null;
        }
        onchange && onchange();
    });
    return {
        getAndReset() {
            const changes = wrapper.changes;
            wrapper = {};

            const deletions = {};
            splitDeletions(changes, deletions);

            return {changes, deletions};
        },
    }
}

function splitDeletions(obj, deletions){
    for (const key in obj) {
        if (obj[key] === removedSymbol) {
            deletions[key] = true;
            delete obj[key];
        } else if (isObject(obj[key])) {
            deletions[key] = {};
            splitDeletions(obj[key], deletions[key]);
            if (Object.keys(obj[key]).length === 0) delete obj[key];
            if (Object.keys(deletions[key]).length === 0) delete deletions[key];
        }
    }
}


// patch
export function patch(item, {changes, deletions}) {
    patchChanges(item, changes);
    patchDeletions(item, deletions);
}
function patchChanges(item, changes) {
    if (changes === undefined) return;
    if (!isObject(changes)) {
        item.value = changes;
    } else {
        for (const key in changes) {
            patchChanges(item.item(key), changes[key]);
        }
    }
}
function patchDeletions(item, deletions) {
    for (const key in deletions) {
        if (deletions[key] === true) item.item(key).remove();
        else if (isObject(deletions[key])) patchDeletions(item.item(key), deletions[key]);
        else console.error('true or {}', deletions[key])
    }
}

const isObject = value => typeof value === 'object' && value !== null;
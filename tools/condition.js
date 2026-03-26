
const operators = {
    'eq':         (a, b) => a === b,
    'ne':         (a, b) => a !== b,
    'gt':         (a, b) => a >   b,
    'gte':        (a, b) => a >=  b,
    'lt':         (a, b) => a <   b,
    'lte':        (a, b) => a <=  b,
    'in':         (a, b) => b.includes(a),
    'nin':        (a, b) => !b.includes(a),
    'exists':     (a, b) => (a !== undefined) === b,
    'includes':   (a, b) => String(a).includes(b),
    'startsWith': (a, b) => String(a).startsWith(b),
    'endsWith':   (a, b) => String(a).endsWith(b),
    'regex':      (a, b) => new RegExp(b).test(String(a)),
};

export function resolveVariables(condition, vars) {
    if (typeof condition === 'string') {
        if (!condition.startsWith('$')) return condition;
        const path = condition.slice(1).split('.');
        return path.reduce((obj, key) => obj?.[key], vars) ?? condition;
    }
    if (Array.isArray(condition)) return condition.map(c => resolveVariables(c, vars));
    if (condition && typeof condition === 'object') {
        return Object.fromEntries(
            Object.entries(condition).map(([k, v]) => [k, resolveVariables(v, vars)])
        );
    }
    return condition;
}

export function matchesCondition(fieldVal, condition, obj) {
    if (!Array.isArray(condition)) return fieldVal === condition; // shorthand eq
    const [op, expected] = condition;
    const resolved = (Array.isArray(expected) && expected[0] === 'ref')
        ? obj[expected[1]]
        : expected;
    return operators[op]?.(fieldVal, resolved) ?? false;
}

// obj → AND über Felder, Array → OR über Einträge
// onUnknownOperator(condition, obj) → bool — für eigene Operatoren (z.B. cascade)
export function evaluate(condition, obj, onUnknownOperator) {
    if (condition === true || condition === false) return condition;
    if (condition == null) return false;

    if (Array.isArray(condition)) {
        const [op] = condition;
        if (typeof op === 'string' && !(op in operators) && op !== 'ref') {
            return onUnknownOperator?.(condition, obj) ?? false;
        }
        // Array → OR
        return condition.some(c => evaluate(c, obj, onUnknownOperator));
    }

    // Object → AND
    if (typeof condition === 'object' && typeof obj === 'object') {
        return Object.entries(condition).every(([key, cond]) =>
            matchesCondition(obj[key], cond, obj)
        );
    }

    return false;
}
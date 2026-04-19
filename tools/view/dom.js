import { resolveRef } from '../schema/utils.js';
import { toInput } from '../schema/render/dom.js';

const isPrimary = (s) => s['x-index'] === 'primary';

export function field(item, editable = true) {
    const s = item.schema ?? {};
    if (!editable || s.readOnly || isPrimary(s)) {
        if (s['x-dataref']) return refDisplay(item);
        const span = document.createElement('span');
        span.textContent = item.get();
        item.addEventListener('change', () => span.textContent = item.get());
        return span;
    }
    const el = s['x-dataref'] ? refSelect(item) : toInput(s);
    return bindInput(el, item);
}

export function selectFromChildren(parent) {
    const select = document.createElement('select');
    const update = async () => {
        if (!parent.filled) await parent.read();
        const prev = select.value;
        select.innerHTML = '';
        select.append(new Option('—', ''));
        for (const child of parent) {
            const display = child.schema?.['x-display'] ?? 'name';
            if (!child.filled) await child.read();
            if (child.has(display)?.filled) await child.has(display).read();
            const opt = new Option(String(child.has(display) ?? child.key), child.key);
            select.append(opt);
        }
        if (prev && !select.querySelector(`option[value="${prev}"]`)) {
            select.append(new Option(prev, prev));
        }
        select.value = prev;
    };
    select.addEventListener('focus', update);
    update();
    return select;
}

export function bindInput(el, item) {
    const sync = () => {
        if (el.type === 'checkbox') {
            el.checked = !!item.get();
        } else {
            const val = String(item.get() ?? '');
            if (el.tagName === 'SELECT' && !el.querySelector(`option[value=${JSON.stringify(val)}]`)) {
                el.append(Object.assign(document.createElement('option'), { value: val, textContent: val }));
            }
            el.value = val;
        }
    };
    sync();
    item.addEventListener('change', sync);
    el.addEventListener('change', async () => {
        const value = el.type === 'checkbox' ? el.checked : el.value;
        el.setAttribute('state', 'saving');
        try {
            await item.set(value);
            el.setAttribute('state', 'saved');
        } catch (err) {
            console.error(err);
            el.setAttribute('state', 'error');
        }
    });
    return el;
}

function refSelect(item) {
    const xref = item.schema?.['x-dataref'];
    const parentRef = xref.endsWith('/$') ? xref.slice(0, -2) : xref;
    const parent = resolveRef(parentRef, item);
    if (!parent) return document.createElement('select');
    const select = selectFromChildren(parent);
    return select;
}

function refDisplay(item) {
    const xref = item.schema?.['x-dataref'];
    const parentRef = xref.endsWith('/$') ? xref.slice(0, -2) : xref;
    const parent = resolveRef(parentRef, item);
    const span = document.createElement('span');
    span.textContent = item.get() ?? '';
    if (!parent) return span;
    (async () => {
        if (!parent.filled) await parent.read();
        const refItem = parent.has(item.get() ?? '');
        if (!refItem) return;
        if (!refItem.filled) await refItem.read();
        const display = refItem.schema?.['x-display'] ?? 'name';
        span.textContent = String(refItem.has(display) ?? item.get());
    })();
    return span;
}
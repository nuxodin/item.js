// tools/views/uhtml.js
import { html } from "https://esm.sh/uhtml@4";
import { resolveDataRef } from '../schema/schema.experiments.js';

const props     = (item) => Object.entries(item.schema?.properties ?? {});
const isPrimary = (s) => s['x-index'] === 'primary';
const rowProps  = (store) => props({ schema: store.schema?.additionalProperties });

export function field(item, editable = true) {
    const s = item.schema ?? {};

    if (!editable || s.readOnly || isPrimary(s)) {
        if (s['x-dataref']) return refDisplay(item);
        return html`<span>${item.get()}</span>`;
    }

    const set = (e) => item.set(e.target.value);
    if (s['x-dataref']) return refSelect(item);
    if (s.enum) return html`<select onchange="${set}">${s.enum.map(v => html`<option .selected="${v === item.get()}">${v}`)}</select>`;
    if (s.type === 'object' || s.type === 'array') return html`<textarea
                                                       onchange="${(e) => item.set(JSON.parse(e.target.value))}"
                                                       .value="${JSON.stringify(item.get())}"></textarea>`;
    const type = { email:'email', date:'date', 'date-time':'datetime-local', uri:'url' }[s.format] ?? 'text';
    return html`<input type="${type}" .value="${String(item.get() ?? '')}" onchange="${set}">`;
}

export function detail(item, { editable = false } = {}) {
    item.read();
    return html`<dl>
        ${props(item).map(([name, s]) => html`
            <dt>${s.title ?? name}
            <dd>${field(item.item(name), editable)}
        `)}
    </dl>`;
}

export function table(store, { editable = false } = {}) {
    store.read();
    const cols = rowProps(store);
    return html`<table>
        <thead><tr>
            ${cols.map(([name, s]) => html`<th>${s.title ?? name}`)}
            ${editable ? html`<th><button onclick="${() => store.add({})}">+</button>` : ''}
        </tr></thead>
        <tbody>
            ${[...store].map(row => {
                row.read();
                return html`<tr>
                    ${cols.map(([name]) => html`<td>${field(row.item(name), editable)}`)}
                    ${editable ? html`<td width=2><button u1-confirm onclick="${() => row.remove()}">✖</button>` : ''}
                </tr>`;
            })}
        </tbody>
    </table>`;
}

function refSelect(item) {
    const refItem = resolveDataRef(item);
    const parent = refItem.parent;
    parent.read();
    const display = parent.schema?.['x-display'] ?? 'name';
    const value = item.get();
    return html`<select onchange="${(e) => item.set(e.target.value)}">
        ${[...parent.items()].map(child => {
            child.read();
            return html`<option .selected="${child.key === value}" value="${child.key}">
                ${String(child.has(display) ?? child.key)}`;
        })}
    </select>`;
}

function refDisplay(item) {
    const refItem = resolveDataRef(item);
    refItem.read();
    const display = refItem.parent.schema?.['x-display'] ?? 'name';
    return html`<span>${String(refItem.has(display) ?? refItem.key)}</span>`;
}
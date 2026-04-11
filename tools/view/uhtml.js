// tools/views/uhtml.js
import { html } from "https://esm.sh/uhtml@4";
import { field } from './dom.js';

const props = (item) => Object.entries(item.schema?.properties ?? {});

export function detail(item, { editable = false } = {}) {
    item.read();
    return html`<dl>
        ${props(item).map(([name, s]) => html`
            <dt>${s.title ?? name}
            <dd>${field(item.item(name), editable)}
        `)}
    </dl>`;
}

const cachedTableFields = new WeakMap();

export function table(store, { editable = false, cols } = {}) {
    store.read();
    return html`<table>
        <thead><tr>
            ${cols.map(name => html`<th>${store.schema?.additionalProperties?.properties?.[name]?.title ?? name}`)}  
            ${editable ? html`<th><button onclick="${() => store.add({})}">+</button>` : ''}
        </tr></thead>
        <tbody>
            ${[...store].map(row => {
                row.read();
                row.keys;
                return html`<tr>
                    ${cols.map(name => {
                        const cell = row.item(name);
                        return html`<td>${cachedTableFields.get(cell) ?? cachedTableFields.set(cell, field(cell, editable)).get(cell)}`
                    })}
                    ${editable ? html`<td width=2><button u1-confirm onclick="${() => row.remove()}">✖</button>` : ''}
                </tr>`;
            })}
        </tbody>
    </table>`;
}

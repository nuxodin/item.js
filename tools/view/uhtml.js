// tools/views/uhtml.js
import { html } from "https://esm.sh/uhtml@4";
import { resolveDataRef } from '../schema/utils.js';
import { resolveType, toInput } from '../schema/dom/toInput.js';

const props     = (item) => Object.entries(item.schema?.properties ?? {});
const isPrimary = (s) => s['x-index'] === 'primary';

export function detail(item, { editable = false } = {}) {
    item.read();
    return html`<dl>
        ${props(item).map(([name, s]) => html`
            <dt>${s.title ?? name}
            <dd>${field(item.item(name), editable)}
        `)}
    </dl>`;
}

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
                return html`<tr>
                    ${cols.map(name => html`<td>${field(row.item(name), editable)}`)}
                    ${editable ? html`<td width=2><button u1-confirm onclick="${() => row.remove()}">✖</button>` : ''}
                </tr>`;
            })}
        </tbody>
    </table>`;
}


export function field(item, editable = true) {
    const s = item.schema ?? {};
    if (!editable || s.readOnly || isPrimary(s)) {
        if (s['x-dataref']) return refDisplay(item);
        const span = document.createElement('span');
        span.textContent = item.get();
        item.addEventListener('change', () => span.textContent = item.get());
        return span;
    }
    if (s['x-dataref']) return refSelect(item); // todo: setAttribute state vereinheitlichen

    const input = toInput(s, { value: item.get() });
    
    item.addEventListener('change', () => input.value = String(item));

    input.onchange = () => {
        const value = input.type === 'checkbox' ? input.checked : input.value;
        input.setAttribute('state', 'saving');
         
        item.set(value).then(x=>{
            input.setAttribute('state', 'saved');
        }, err => {
            console.error(err);
            input.setAttribute('state', 'error');
        })
    }
    return input;
}

function refSelect(item) {
    const {parent} = resolveDataRef(item);
    const display = parent.schema?.['x-display'] ?? 'name';
    const select = document.createElement('select');
    const nullOpt = new Option('—', '');
    const update = () => {
        select.innerHTML = '';
        select.append(nullOpt);
        for (const child of parent) {
            const opt = new Option(String(child.has(display) ?? child.key), child.key);
            child.read().then(() => {
                opt.innerText = String(child.has(display) ?? child.key);
            });
            select.append(opt);
        }
        select.value = item.get();
    };
    //effect(update)
    parent.read().then(update);
    select.onchange = (e) => item.set(e.target.value);
    item.addEventListener('change', () => select.value = String(item));
    return select;
}



function refDisplay(item) {
    const {parent, refItem} = resolveDataRef(item);
    const span = document.createElement('span');
    parent.read().then(()=>{
        const refItem = parent.has(item.get());
        if (refItem) {
            refItem.read().then(() => {
                const display = parent.schema?.['x-display'] ?? 'name';
                if (display && refItem.has(display)) {
                    span.textContent = String(refItem.has(display));
                }
            });
        }
        else {
            span.textContent = item.get();
        }
    });
    span.textContent = item.get();
    return span;
}

// function refDisplay(item) {
//     const {parent, refItem} = resolveDataRef(item);
//     if (refItem) {
//         refItem.read();
//         const display = parent.schema?.['x-display'] ?? 'name';
//         if (display && refItem.has(display)) {
//             return html`<span>${String(refItem.has(display))}</span>`;
//         }
//     }
//     const span = document.createElement('span');
//     span.textContent = item.get();
//     const update = () => {
//         if (refItem) {
//             const display = parent.schema?.['x-display'] ?? 'name';
//             if (display && refItem.has(display)) {
//                 span.textContent = String(refItem.has(display));
//             }
//         }
//     };
//     refItem?.addEventListener('change', update);
//     return span;

//     return html`<span>${item.get()}</span>`;
// }
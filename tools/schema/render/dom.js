import { inputNode } from '../build/input.js'

export function render(node) {
    if (typeof node === 'string') return document.createTextNode(node)

    const el = document.createElement(node.tag)

    if (node.attrs) {
        for (const [k, v] of Object.entries(node.attrs)) {
            if (v === false || v == null) continue
            if (k === 'indeterminate') { el.indeterminate = !!v; continue }
            if (v === true) el.setAttribute(k, '')
            else            el.setAttribute(k, String(v))
        }
    }

    if (node.children) {
        for (const c of node.children) el.append(render(c))
    }

    return el
}

export function toInput(schema, opts) {
    return render(inputNode(schema, opts))
}

import { inputNode } from '../build/input.js'

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

export function render(node) {
    if (typeof node === 'string') return escapeText(node)

    const attrs = renderAttrs(node.attrs)
    if (VOID_TAGS.has(node.tag)) return `<${node.tag}${attrs}>`

    const inner = (node.children ?? []).map(render).join('')
    return `<${node.tag}${attrs}>${inner}</${node.tag}>`
}

export function toInput(schema, opts) {
    return render(inputNode(schema, opts))
}

function renderAttrs(attrs) {
    if (!attrs) return ''
    const parts = []
    for (const [k, v] of Object.entries(attrs)) {
        if (v === false || v == null) continue
        if (k === 'indeterminate') {
            if (v) parts.push('data-indeterminate="true"')
            continue
        }
        if (v === true) parts.push(k)
        else            parts.push(`${k}="${escapeAttr(v)}"`)
    }
    return parts.length ? ' ' + parts.join(' ') : ''
}

function escapeAttr(v) {
    return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function escapeText(v) {
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

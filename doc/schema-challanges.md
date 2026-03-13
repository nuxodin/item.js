# JSON Schema Integration for item.js — Open Questions & Challenges

## Core API

- [x] Only `setSchema()` — `schema =` throws with hint to use setSchema()
- [x] `schema` getter returns inherited schema (recursive via parent)
- [x] Original schema referenced as-is — external mutation intentional
- [ ] Deep merge when sub-item overrides? (currently: throws instead)
- [ ] `$ref / $defs` — async resolution needed. When? Eagerly on `setSchema()` or lazily on first access?
- [ ] `allOf / anyOf / oneOf` — how does this interact with a future merge strategy?

---

## Validation — when & where

- [ ] Should validation be active by default when a schema is set, or opt-in?
- [ ] On error: `throw`, `e.preventDefault()`, dispatch a `"validationError"` event, or return errors[]?
- [ ] Where to validate in the tree? The item itself, the nearest schema ancestor, or all ancestors?
- [ ] How to prevent double-validation when multiple ancestors have schemas?
- [ ] `required` fields: validate on every `set()` or only on explicit `validate()` call? (problem: partial/lazy-loaded trees)
- [ ] Should `validate()` be a method for on-demand full validation (incl. `required`, `dependentRequired`)?

---

## Schema inheritance across the tree

- [x] `root.item('x').schema` returns sub-schema automatically via `properties` / `items` / `additionalProperties`
- [x] `setSchema()` throws if any ancestor already has a schema
- [x] Inheritance is recursive — works at any depth
- [ ] Sub-item schema override + merge: not yet supported (throws for now)
- [ ] `if / then / else` — requires sibling context, not just the item's own value. Who evaluates this?
- [ ] `dependentRequired` — same problem: one field depends on another

---

## Partial / remote data

- [ ] Items may not exist yet because data is still loading from remote
- [ ] `required` validation would produce false errors on incomplete trees
- [ ] Need a way to distinguish "not yet loaded" from "intentionally absent"
- [ ] How does this interact with the `io` / `reader` / `pending` system already in item.js?

---

## Internationalization

- [ ] `title` / `description` in JSON Schema are single strings — not multi-language
- [ ] `x-title: { de: "...", en: "..." }` would work but is non-standard (though valid as custom extension)
- [ ] Who resolves the label — item.js, the consumer, or a separate resolver module?
- [ ] Should resolution be configurable globally (`Item.resolveLabel`) or per-item?

---

## Form generation

- [ ] Which schema keywords map to which HTML input types? (`type`, `format`, `enum` → select, etc.)
- [ ] Where does form generation live — in this mixin or a separate `form.mixin.js`?
- [ ] How to handle nested objects / arrays in a form?
- [ ] `x-*` extensions for UI hints (placeholder, order, hidden, etc.) — define a convention?

---

## Other features (from initial brainstorm)

- [ ] `readOnly` — block `set()`, warn or throw?
- [ ] `writeOnly` — `get()` returns `undefined`?
- [ ] `deprecated` — `get()` triggers `console.warn`
- [ ] `default` — should `get()` return the schema default when no value is set (non-destructive)?
- [ ] `examples` — useful for devtools / mocks, but where does item.js surface them?

---

## Architecture

- [ ] All in one `schema.mixin.js` or split into `schema.mixin.js`, `validate.mixin.js`, `form.mixin.js`?
- [ ] Which validator library? ajv (full JSON Schema support, heavy) vs. custom mini-validator (lightweight, incomplete)?
- [ ] Performance: `schema` getter recomputes on every access — cache needed? When to invalidate?
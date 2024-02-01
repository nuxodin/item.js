
# item.js

## Overview

The `Item` class represents observable, reactive data, which can also be structured.
It is the base class for all other observable classes in this project.
To create an "item" you should use the `item` factory function, which will return an instance of `Item`.

```js
import { item } from 'item.js';
const myItem = item(3);
const myObject = item({ foo: 'bar' });
```

### Properties

- `parent`: Returns the item's parent or `null` if it is the root item.
- `key`: Returns the item's key within its parent.
- `value`: Gets or sets the value of the item. basicly an alias for `get()` and `set(value)`.

### Basic Methods

#### `get()`

Retrieves the item's current value, applying any necessary transformations and triggering effect registration.

#### `set(value)`

Sets the item's value, triggers change detection, and dispatches events as needed.

#### `item(key)`

Retrieves or initializes a child item with the specified key.

#### `remove()`

Removes the item from its parent.

#### `has(key)`

Checks if a given key exists in the item's value.


### Events

Each item is an event target and dispatches events when its value changes.

#### `change`

Dispatched when the item's value changes.
```
myItem.addEventListener('change', () => console.log('Item changed!'));
myItem.set('Hello, world!');
```

#### `changeIn`

Same as `change`, but also dispatched when a child item's value changes.
```js
myItem.addEventListener('changeIn', () => console.log('Item changed in path!'));
myItem.item('foo').set('bar');
```

#### `set`

Dispatched when the item's value is set.
The difference between `set` and `change` is that `set` is dispatched even if the value is unchanged.
This can happen 
- when you try to set the same value again,
- when the actual change happens asynchronously,
- or if the change has failed.
```js
myItem.addEventListener('set', () => console.log('Item value set!'));
myItem.set('Hello, world!');
```

#### `setIn`

Same as `set`, but also dispatched when a child item's value is set.


#### `get`

Dispatched when the item's value is retrieved.
```
myItem.addEventListener('get', () => console.log('Item value retrieved!'));
myItem.get();
```


#### `getIn`

Same as `get`, but also dispatched when a child item's value is retrieved.


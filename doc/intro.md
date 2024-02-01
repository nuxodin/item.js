
# Introduction

This library provides a flexible and extensible implementation for reactive data and data structures.

## Basic Usage

To create a new item and work with values, use:

```javascript
import { item } from 'item.js';
const myItem = item('initial value');
console.log(myItem.value); // Accessing the value
```

## Primitive Values

Primitive values (e.g., `string`, `number`, `boolean`) are stored directly and updated upon changes.

```javascript
myItem.value = 123; // Sets a primitive value
```

## Structured Data

For structured data (e.g., objects or arrays), the library allows creating nested items that can be individually observed and manipulated:

```javascript
myItem.value = { nested: { key: 'value' } }; // Creates a nested item
console.log(myItem.item('nested').item('key').value); // Accessing nested values
```

## Proxy

By using a proxy, you can interact directly with your item as if it were a regular JavaScript object

```javascript
const proxiedItem = myItem.proxy;
myItem.nested.key = 'newValue';
```

## Effect

The `effect` function allows defining side effects that are automatically re-executed when the observed data changes. This is useful for reactivity:

```javascript
effect(() => console.log(myItem.value)); // Re-executes when `myItem.value` changes
```

## Events

Changes to items trigger `change` events, allowing subscribers to react to modifications. It also supports `get` and `set` events for more finely controlled interactions.

```javascript
myItem.addEventListener('change', () => console.log('Item changed'));
```


## Conclusion

This library simplifies working with reactive data in JavaScript by providing a robust API for creating, observing, and reacting to changes in data structures. It encourages the development of declarative and reactive code that is easy to read and maintain.

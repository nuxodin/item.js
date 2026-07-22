import { Emitter } from "./src/Emitter.js";
import type { AsyncDataPoint } from "./src/AsyncDataPoint.js";

export const $item: unique symbol;

export class Item<TRoot extends Item<any> = Item<any>> extends Emitter {
    constructor(parent?: Item, key?: string);

    readonly key: string | null;
    readonly parent: TRoot | null;
    readonly filled: boolean;
    readonly isObject: boolean | null;
    value: any;
    
    // Async Status & IO
    readonly io: AsyncDataPoint;
    readonly pending: boolean;
    readonly error: Error | undefined;
    /** Nearest self-or-ancestor with a reader/writer — the item that talks to the source for this one. */
    readonly ioOwner: Item | null;
    /** Did the region's full value ever arrive from its source? Resolves via ioOwner; expires with io ttl. */
    readonly loaded: boolean;
    promise: Promise<any>;

    // Hooks (Callbacks)
    reader?: (query?: any, options?: any) => Promise<any>;
    writer?: (value: any, options?: any) => Promise<any>;
    /** Declares: my reader delivers the whole region. Enables partial writes (child set/patch) once loaded. */
    readsFull?: boolean;
    adder?: (value: any) => Promise<{key: string}>;
    remover?: (options?: any) => Promise<any>;

    // Core Methods
    get(options?: { depth?: number }): any;
    set(value: any, options?: { patch?: boolean, local?: boolean, depth?: number }): Promise<any> | undefined;
    patch(value: any): Promise<any> | undefined;
    clear(): void;
    
    // Traversal & Structure
    item(key: any): TRoot;
    sub(...keys: (string | string[])[]): Item;
    add(value: any): Promise<Item>;
    generateKey(): string;
    remove(options?: { local?: boolean }): Promise<void>;
    has(...keys: (string | string[])[]): Item | undefined;
    
    readonly keys: string[] | readonly never[];
    readonly path: string[] | readonly never[];
    readonly root: TRoot;
    items(): Item[];

    // Data Sync
    read(query?: object): Promise<any>;
    
    // JSON Schema
    setSchema(schema: object): void;
    readonly schema: Record<string, any> | null;

    // Misc
    readonly proxy: ItemProxy;
    toJSON(): any;
    toString(): string;
    [Symbol.toPrimitive](hint: "string" | "number" | "default"): any;

    // Iterators
    [Symbol.iterator](): Iterator<Item>;
    [Symbol.asyncIterator](): AsyncIterator<Item>;

    // Static & Customization
    ChildClass: typeof Item | false | undefined;
    static ChildClass: typeof Item | false | undefined;
    static isPrimitive(value: unknown): boolean;
    static equals(a: unknown, b: unknown): boolean;
}

/*
export type ItemValue = unknown;

export type ItemProxy = ItemProxyMethods & {
    [key: string]: ItemProxy;
};

export interface ItemProxyMethods {
    readonly [$item]: Item;
    (): ItemValue;
    (value: ItemValue): Promise<any> | undefined;
    then<TResult1 = ItemValue, TResult2 = never>(
        onfulfilled?: ((value: ItemValue) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2>;
    [Symbol.iterator](): Iterator<ItemProxy>;
}
*/

export type ItemValue = unknown;

export type ItemProxy<T = ItemValue, TRaw extends Item = Item> = ItemProxyMethods<T, TRaw> & ItemProxyChildren;

export interface ItemProxyChildren { [key: string]: ItemProxy<unknown, Item>; }

export interface ItemProxyMethods<T = ItemValue,TRaw extends Item = Item> {
    readonly [$item]: TRaw;
    <TValue = T>(): TValue;
    (value: unknown): Promise<any> | undefined;
    then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2>;
    [Symbol.iterator](): Iterator<ItemProxy>;
    [Symbol.asyncIterator](): AsyncIterator<Item>;
}
/* */

export function item(...args: any[]): Item;

export function dispatch(item: Item, eventName: string, options: object): { defaultPrevented: boolean };

import { Emitter } from "./src/Emitter.js";
import { AsyncDataPoint } from "./src/AsyncDataPoint.js";

export class Item extends Emitter {
    constructor(parent?: Item, key?: string);

    readonly key: string | null;
    readonly parent: Item | null;
    readonly filled: boolean;
    readonly isObject: boolean | null;
    value: any;
    
    // Async Status & IO
    readonly io: AsyncDataPoint;
    readonly pending: boolean;
    readonly error: any | undefined;
    promise: Promise<any>;

    // Hooks (Callbacks)
    reader?: (query?: any, options?: any) => Promise<any>;
    writer?: (value: any, options?: any) => Promise<any>;
    adder?: (value: any) => Promise<{key: string} | any>;
    remover?: (options?: any) => Promise<any>;

    // Core Methods
    get(options?: { depth?: number }): any;
    set(value: any, options?: { patch?: boolean, local?: boolean, depth?: number }): Promise<any> | undefined;
    patch(value: any): Promise<any> | undefined;
    clear(): void;
    
    // Traversal & Structure
    item(key: any): Item;
    sub(...keys: (string | string[])[]): Item;
    add(value: any): Promise<Item>;
    generateKey(): string;
    remove(options?: { local?: boolean }): Promise<void>;
    has(...keys: (string | string[])[]): Item | undefined;
    
    readonly keys: string[] | readonly never[];
    readonly path: string[] | readonly never[];
    readonly root: Item;
    items(): Item[];

    // Data Sync
    read(query?: object): Promise<any>;
    
    // JSON Schema
    setSchema(schema: object): void;
    readonly schema: Record<string, any> | null;

    // Misc
    readonly proxy: any;
    toJSON(): any;
    toString(): string;
    [Symbol.toPrimitive](hint: "string" | "number" | "default"): any;

    // Iterators
    [Symbol.iterator](): Iterator<Item>;
    [Symbol.asyncIterator](): AsyncIterator<Item>;

    // Static & Customization
    ChildClass: typeof Item | false | undefined;
    static ChildClass: typeof Item | false | undefined;
    static isPrimitive(value: any): boolean;
    static equals(a: any, b: any): boolean;
}

export function item(...args: any[]): Item;

export function dispatch(item: Item, eventName: string, options: object): { defaultPrevented: boolean };
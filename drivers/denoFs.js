import { AsyncItem } from '../tools/AsyncItem.js';
import { ensureDir } from "https://deno.land/std@0.182.0/fs/mod.ts";

export function denoFs(rootPath, options) {
    const root = new FsItem();
    root.fsRootPath = rootPath;

    if (options?.watch) {
        const watcher = Deno.watchFs(rootPath);
        setTimeout(async () => {
            for await (const event of watcher) {
                for (const path of event.paths) {
                    // get the path relative to the root
                    const relativePath = path.substring(rootPath.length + 1);
                    const pathArray = relativePath.split(/[\\\/]/);
                    const targetItem = relativePath === '' ? root : root.walkPathKeys(pathArray);
                    if (event.kind === 'modify') {
                        // todo, only make this if item is already accessed?
                        const contents = await Deno.readTextFile(targetItem.fsPath);
                        targetItem.asyncHandler.setFromMaster(contents);
                    }
                    //if (event.kind === 'create') {}
                    if (event.kind === 'remove') {
                        targetItem.remove();
                    }
                }
            }
        });
    }

    return root;
}

class FsItem extends AsyncItem {
    constructor(parent, key) {
        super(parent, key);
        if (parent) {
            if (key === '') throw new Error('key cannot be empty');
            if (key.startsWith('.')) throw new Error('key cannot start with a dot');
            if (key.includes('/')) throw new Error('key cannot contain a slash');
        }
    }
    async createGetter() {
        let info = {};
        try {
            info = await Deno.stat(this.fsPath);
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                return undefined;
            }
            throw e;
        }
        if (info.isFile) {
            return Deno.readTextFile(this.fsPath);
        }
        if (info.isDirectory) {
            // this.loadItems();
            // return this;
            const list = Object.create(null);
            for await (const dirEntry of Deno.readDir(this.fsPath)) {
                list[dirEntry.name] = this.item(dirEntry.name);
            }
            return list;
        }
    }
    async createSetter(value) {
        if (typeof value === 'string') { // if string its a file
            await ensureDir(this.parent.fsPath);
            return Deno.writeTextFile(this.fsPath, value);
        }

        const promises = [];
        for (const key in value) {
            const promise = this.item(key).set(value[key]);
            promises.push(promise);
        }
        // todo, await all children setters?
        return Promise.resolve(promises);
    }
    async loadItems() { // if directory, load all children, todo
        for await (const dirEntry of Deno.readDir(this.fsPath)) {
            this.item(dirEntry.name);
            // this.item(dirEntry.name).type = dirEntry.isDirectory ? 'directory' : 'file';
        }
    }
    get fsPath() {
        if (this.parent == null) return this.fsRootPath;
        return this.parent.fsPath + '/' + this.key;
    }
    async remove() {
        super.remove();
        await Deno.remove(this.fsPath, { recursive: true });
    }
    static isPrimitive() { // as every item can be an object
        return false;
    }
    static ChildClass = FsItem;
}


//import { jsonDataItem } from '../tools/jsonDataItem.js';

export async function jsonFile(path) {
    const {jsonDataItem} = await import('../tools/jsonDataItem.js');
    const fileItem = denoFs(path, {watch: true})
    return await jsonDataItem(fileItem);
}

import { AsyncItem } from '../tools-old/AsyncItem.js';
import { ensureDir } from "https://deno.land/std@0.182.0/fs/mod.ts";
import * as p from "https://deno.land/std/path/mod.ts";

export function denoFs(rootPath, options) {
    // 👉 Root absolut machen
    const rootAbs = p.resolve(rootPath);

    const root = new FsItem();
    root.fsRootPath = rootAbs;

    if (options?.watch) {
        const watcher = Deno.watchFs(rootAbs);

        setTimeout(async () => {
            for await (const event of watcher) {
                for (const filePath of event.paths) {

                    // 👉 Immer absolut + sauber normieren
                    const fileAbs = p.resolve(filePath);

                    // 👉 Sauber relativieren
                    let relativePath = p.relative(rootAbs, fileAbs);
                    relativePath = p.normalize(relativePath);

                    // Leere oder ungültige Events ignorieren
                    if (!relativePath || relativePath === '.' || relativePath.startsWith('../')) {
                        continue;
                    }

                    const pathArray = relativePath.split(/[\\\/]/).filter(Boolean);

                    const targetItem = root.sub(pathArray);

                    if (event.kind === 'modify') {
                        const contents = await Deno.readTextFile(targetItem.fsPath);
                        targetItem.asyncHandler.setLocal(contents);
                    }

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
            if (key === '.' || key === '..') throw new Error('key cannot be . or ..');
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
            // return this;
            const list = Object.create(null);
            for await (const dirEntry of Deno.readDir(this.fsPath)) {
                //list[dirEntry.name] = this.item(dirEntry.name);
                list[dirEntry.name] = await this.item(dirEntry.name).promise;
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
        return await Promise.all(promises);
    }
    async loadItems() {
        for await (const dirEntry of Deno.readDir(this.fsPath)) {
            this.item(dirEntry.name);
            //this.item(dirEntry.name); //.isObject = dirEntry.isDirectory;
            //this.item(dirEntry.name); //.length = ;
        }
    }
    get fsPath() {
        if (this.parent == null) return this.fsRootPath;
        return this.parent.fsPath + '/' + this.key;
    }
    async remove() {
        try {
            await Deno.remove(this.fsPath, { recursive: true });
        } catch (e) {
            if (!(e instanceof Deno.errors.NotFound)) {
                throw e; // Re-throw wenn es kein "NotFound" Error ist
            }
            // Datei existiert nicht -> OK, weitermachen
        }
        if (this.parent) super.remove();
    }
    static isPrimitive() { // as every item can be an object
        return false;
    }
    static ChildClass = FsItem;
}


export async function jsonFile(path) {
    const {jsonDataItem} = await import('../tools/jsonDataItem.js');
    const fileItem = denoFs(path, {watch: true})
    return await jsonDataItem(fileItem);
}

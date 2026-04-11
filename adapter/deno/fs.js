import { Item } from '../../item.js';
import { ensureDir, ensureFile } from "https://deno.land/std@0.182.0/fs/mod.ts";
import * as p from "https://deno.land/std/path/mod.ts";

export function fs(rootPath, options) {
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
                        targetItem.io.setLocal(contents);
                    }

                    if (event.kind === 'remove') {
                        targetItem.remove({local:true});
                    }
                }
            }
        });
    }

    return root;
}

class FsItem extends Item {
    constructor(parent, key) {
        super(parent, key);
        if (parent) {
            if (key === '') throw new Error('key cannot be empty');
            if (key === '.' || key === '..') throw new Error('key cannot be . or ..');
            if (key.includes('/')) throw new Error('key cannot contain a slash');
        }
    }
    get fsPath() {
        if (this.parent == null) return this.fsRootPath;
        return this.parent.fsPath + '/' + this.key;
    }
    async reader() {
        let info = {};
        try {
            info = await Deno.stat(this.fsPath);
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) return null;
            throw e;
        }
        if (info.isFile) {
            return Deno.readTextFile(this.fsPath);
        }
        if (info.isDirectory) {
            for await (const dirEntry of Deno.readDir(this.fsPath)) {
                const sub = this.item(dirEntry.name);
                sub.meta = {};
                sub.meta.isDirectory = dirEntry.isDirectory;
            }
        }
    }
    async writer(value) {
        if (typeof value === 'string') {
            await ensureDir(p.dirname(this.fsPath));
            return Deno.writeTextFile(this.fsPath, String(value));
        }
        const promises = [];
        for (const key in value) {
            const promise = this.item(key).set(value[key]);
            promises.push(promise);
        }
        return await Promise.all(promises);
    }
    async remover() {
        try {
            await Deno.remove(this.fsPath, { recursive: true });
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) return;
            else throw e;
        }
    }

    static ChildClass = FsItem;
}


export async function jsonFile(path) {
    const {jsonDataItem} = await import('../../tools/jsonDataItem.js');
    await ensureFile(path);      
    const fileItem = fs(path, {watch: true})
    return await jsonDataItem(fileItem);
}

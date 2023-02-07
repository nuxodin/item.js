import { AsyncItem } from '../tools/AsyncItem.js';

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
                    const targetItem = root.walkPathKeys(pathArray);
                    if (event.kind === 'modify') {
                        // todo, only make this if item is already accessed?
                        const contents = await Deno.readTextFile(targetItem.fsPath);
                        targetItem.master.setFromMaster(contents);
                    }
                    // if (event.kind === 'create') {}
                    // if (event.kind === 'remove') {}
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
            if (key.startsWith('.')) throw new Error('key cannot start with a dot');
            if (key.includes('/')) throw new Error('key cannot contain a slash');
        }
    }
    async createGetter() {
        const info = await Deno.stat(this.fsPath);
        if (info.isFile) {
            return Deno.readTextFile(this.fsPath);
        }
        if (info.isDirectory) {
            const list = Object.create(null);
            for await (const dirEntry of Deno.readDir(this.fsPath)) {
                list[dirEntry.name] = this.item(dirEntry.name);
            }
            return list;
        }
    }
    createSetter(value) {
        if (typeof value === 'string') { // if string its a file
            return Deno.writeTextFile(this.fsPath, value);
        }

        for (const key in value) {
            this.item(key).value = value[key];
        }
        // todo, await all children setters?
        return Promise.resolve({});
    }
    get fsPath() {
        if (this.parent == null) return this.fsRootPath;
        return this.parent.fsPath + '/' + this.pathKeys.join('/');
    }
}

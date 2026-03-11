import { Item } from '../item.js';

class CookieItem extends Item {
    reader() {
        return cookieStore.get(this.key).then(data => data?.value ?? '');
    }
    writer(value) {
        return cookieStore.set({
            name: this.key,
            value,
            expires: new Date(Date.now() + 1000*60*60*24*365*2),
        });
    }
    $set(value) {
        super.$set(String(value));
    }
    remove() {
        super.remove();
        return cookieStore.delete(this.key);
    }
    static ChildClass = false;
}

class CookieStore extends Item {
    async reader() {
        const cookies = await cookieStore.getAll();
        for (const c of cookies) {
            this.item(c.name).io.setLocal(c.value);
        }
    }
    static ChildClass = CookieItem;
}

const root = new CookieStore();
root.io.options.ttl = 10000;
cookieStore.addEventListener?.('change', e => {
    e.deleted.forEach(c => root.item(c.name).remove());
    e.changed.forEach(c => root.item(c.name).io.setLocal(c.value));
});

export const cookie = root;
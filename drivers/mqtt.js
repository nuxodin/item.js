import { Client } from 'https://deno.land/x/mqtt@0.1.2/deno/mod.ts';
import { AsyncItem } from '../tools/AsyncItem.js';


export async function mqtt(options){
    const client = new Client(options); // Deno and Node.js
    await client.connect();
    await client.subscribe(options.subscribe || '#');

    const decoder = new TextDecoder();

    client.on('message', (topic, payload) => {
        const text = decoder.decode(payload);
        const pathArray = topic.split('/');
        const targetItem = root.walkPathKeys(pathArray);
        targetItem.master.setFromMaster(text);
    });

    class MQTTItem extends AsyncItem {
        createGetter() { // // mqtt does not have a concept of getting a value
            client.subscribe(this.pathKeys.join('/')); // ok? or should we subscribe to all children?
            return Promise.resolve(null);
        }
        createSetter(value) {
            if (!this.constructor.isPrimitive(value)) return Promise.resolve(value);
            const topic = this.pathKeys.join('/');
            return client.publish(topic, String(value));
        }
        remove(){ throw new Error('cannot remove mqtt item'); }
        ChildClass = MQTTItem;
    }
    const root = new MQTTItem();
    return root;
    //await client.disconnect();
}

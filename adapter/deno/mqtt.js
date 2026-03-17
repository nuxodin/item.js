import { Client } from 'https://deno.land/x/mqtt@0.1.2/deno/mod.ts';
import { Item } from '../../item.js';

export async function mqtt(options){
    const client = new Client(options);
    client.connect(); // await? or lazy? when disconnect?

    const decoder = new TextDecoder();
    client.on('message', (topic, payload) => {
        const text = decoder.decode(payload);
        const pathArray = topic.split('/');
        const targetItem = root.sub(pathArray);
        targetItem.set(text, { local: true });
    });

    class MQTTItem extends Item {
        reader() { // mqtt does not have a concept of getting a value
            const topic = [...this.path, '#'].join('/');
            client.subscribe(topic); // ok? or should we subscribe to all children?
        }
        writer(value) {
            if (!this.constructor.isPrimitive(value)) return Promise.resolve(value);
            const topic = this.path.join('/');
            return client.publish(topic, String(value));
        }
        remover() {
            const topic = [...this.path, '#'].join('/');
            return client.unsubscribe(topic);
        }
    }
    
    const root = new MQTTItem();
    return root;
}

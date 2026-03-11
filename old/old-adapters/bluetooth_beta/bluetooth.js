import { Item } from '../../item.js';
import { AsyncItem } from '../../tools/AsyncItem.js';


class Device extends Item {
    constructor(options) {
        super();
        this.options = options;
    }
    async connect(){
        try {
            this.realDevice = await navigator.bluetooth.requestDevice(this.options);
            await this.realDevice.gatt.connect();    
        } catch(e) {
            throw e;
        }
    }
    async loadAll() {
        const services = await this.realDevice.gatt.getPrimaryServices();
        for (const service of services) {
            const item = this.item(service.uuid);
            item.realService = service;
        }
    }
    ChildClass = Service;
}

class Service extends Item {
    constructor(parent, key) {
        super(parent, key);
        this.realDevice = parent.realDevice;
    }
    async connect(){
        if (!this.realService) {

            try {
                this.realService = await this.realDevice.gatt.getPrimaryService(this.key);
            } catch (e) {
                console.error(e);
                return;
            }

        }
        return this.realService;
    }
    async loadAll() {
        const service = await this.connect();
        const characteristics = await service.getCharacteristics();
        for (const characteristic of characteristics) {
            const item = this.item(characteristic.uuid);
            item.realCharacteristic = characteristic;
        }
    }
    ChildClass = Characteristic;
}

class Characteristic extends AsyncItem {
    constructor(parent, key) {
        super(parent, key);
        this.asyncHandler.options.ttl = 10000;
    }
    async connect(){
        if (!this.realCharacteristic) {

            try {
                const service = await this.parent.connect();
                this.realCharacteristic = await service.getCharacteristic(this.key);    
            } catch (e) {
                console.error(e);
                return;
            }


        }
        this.realCharacteristic.startNotifications();
        this.realCharacteristic.addEventListener('characteristicvaluechanged',e=>{
            let value = e.target.value.getUint8(0);
            this.asyncHandler.setLocal(value);
        });
        return this.realCharacteristic;
    }
    async createGetter() {
        const characteristic = await this.connect();
        if (!characteristic.properties.read) {
            console.error('Read operation is not supported by this characteristic.');
            return undefined;
            //throw new Error('Read operation is not supported by this characteristic.');
        }
        const buffer = await characteristic.readValue();
        if (buffer.byteLength === 1) {
            return buffer.getUint8(0);
        } else {
            return new TextDecoder().decode(buffer);
        }
    }
    async createSetter(value) {
        const characteristic = await this.connect();
        
        if (!characteristic.properties.write && !characteristic.properties.writeWithoutResponse) {
            throw new Error('Write operations are not supported by this characteristic.');
        }

        let buffer = null;
        if (Number.isInteger(value)) {
            buffer = new Uint8Array([value]);
        } else if (typeof value === 'boolean') {
            buffer = new Uint8Array([value ? 1 : 0]);
        } else if (value == null) {
            buffer = new Uint8Array([0]);
        } else if (typeof value === 'string') {
            buffer = new TextEncoder().encode(value);
        } else if (Array.isArray(value)) {
            buffer = new Uint8Array(value);
        } else {
            throw new Error('Invalid value type');
        }
        return characteristic.writeValueWithoutResponse(buffer);
    }
    ChildClass = null;
}




export async function requestDevice(options) {
    const device = new Device(options);
    await device.connect();
    return device;
}


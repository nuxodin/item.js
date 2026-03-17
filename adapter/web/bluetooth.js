import { Item } from '../../item.js';

class BluetoothCharacteristic extends Item {
    get _connection() {
        return this._connectionPromise ??= this._connect();
    }
    async _connect() {
        if (!this._realCharacteristic) {
            const service = await this.parent._connection;
            this._realCharacteristic = await service.getCharacteristic(this.key);
        }
        const c = this._realCharacteristic;
        if (c.properties.notify || c.properties.indicate) {
            this._onNotify = e => this.value = decode(e.target.value);
            c.addEventListener('characteristicvaluechanged', this._onNotify);
            await c.startNotifications();
        }
        return c;
    }
    async reader() {
        const c = await this._connection;
        if (!c.properties.read) return undefined;
        return decode(await c.readValue());
    }
    async writer(value) {
        const c = await this._connection;
        if (!c.properties.write && !c.properties.writeWithoutResponse) {
            throw new Error('Write not supported by this characteristic');
        }
        return c.writeValueWithoutResponse(encode(value));
    }
    remover() {
        if (this._realCharacteristic && this._onNotify) {
            this._realCharacteristic.removeEventListener('characteristicvaluechanged', this._onNotify);
            this._realCharacteristic.stopNotifications().catch(() => {});
        }
    }
    static ChildClass = null;
}

class BluetoothService extends Item {
    get _connection() {
        return this._connectionPromise ??= this._connect();
    }
    async _connect() {
        if (this._realService) return this._realService;
        return this._realService = await this.parent._realDevice.gatt.getPrimaryService(this.key);
    }
    async reader() {
        const service = await this._connection;
        const characteristics = await service.getCharacteristics();
        for (const c of characteristics) {
            this.item(c.uuid)._realCharacteristic = c;
        }
    }
    static ChildClass = BluetoothCharacteristic;
}

class BluetoothDevice extends Item {
    constructor(options) {
        super();
        this._options = options;
    }
    async connect() {
        this._realDevice = await navigator.bluetooth.requestDevice(this._options);
        const gatt = this._realDevice.gatt;
        await gatt.connect();
        this._realDevice.addEventListener('gattserverdisconnected', () => this._onDisconnect());
    }
    _onDisconnect() {
        // surface error, then try to reconnect
        // (clear connection promises so lazy getters retry)
        for (const service of this) service._connectionPromise = null;
        this.promise = this._realDevice.gatt.connect().then(() => {
            for (const service of this) service._connectionPromise = null;
        });
    }
    async reader() {
        const services = await this._realDevice.gatt.getPrimaryServices();
        for (const service of services) {
            this.item(service.uuid)._realService = service;
        }
    }
    static ChildClass = BluetoothService;
}


function decode(dataView) {
    if (dataView.byteLength === 1) return dataView.getUint8(0);
    return new TextDecoder().decode(dataView);
}
function encode(value) {
    if (typeof value === 'boolean') return new Uint8Array([value ? 1 : 0]);
    if (Number.isInteger(value))    return new Uint8Array([value]);
    if (typeof value === 'string')  return new TextEncoder().encode(value);
    if (Array.isArray(value))       return new Uint8Array(value);
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value;
    throw new TypeError(`Unsupported value type: ${typeof value}`);
}

export async function requestDevice(options) {
    const device = new BluetoothDevice(options);
    await device.connect();
    return device;
}
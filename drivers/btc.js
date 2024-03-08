import { item, Item } from '../item.js';
import { AsyncItem } from '../tools/AsyncItem.js';


class BalanceItem extends AsyncItem {
    constructor(parent, key) {
        super(parent, key);
        this.asyncHandler.options.cacheDuration = 10000;
    }
    async createGetter() {
        try {
            const response = await fetch(`https://blockchain.info/balance?active=${this.parent.key}`);
            const data = await response.json();
            return data[this.parent.key].final_balance / 100000000;
        } catch (error) {
            console.error('Error fetching Bitcoin balance:', error);
            throw error;
        }
    }    
    createSetter() { throw new Error('balance is readonly'); }
}
class WalletItem extends Item {
    constructor(parent, key) {
        super(parent, key);
        this.ChildClass = BalanceItem;
        this.item('balance');
        this.ChildClass = null;
        this.$set = function () { throw new Error('wallet is readonly'); };
        //this.watch();
    }
    ChildClass = Item;

    // watch() { // todo: implement
    //     const socket = new WebSocket('wss://ws.blockchain.info/inv');
    //     socket.addEventListener('open', () => {
    //         socket.send(JSON.stringify({ "op": "addr_sub", "addr": this.key }));
    //     });
    //     socket.addEventListener('message', (event) => {
    //         const parsedData = JSON.parse(event.data);
    //         if (parsedData.op === 'utx') {
    //             this.item('balance').asyncHandler.setFromMaster(parsedData.x.balance / 100000000);
    //         }
    //     });
    //     socket.addEventListener('error', (error) => console.error('WebSocket Error:', error) );
    //     socket.addEventListener('close', () => console.log('WebSocket connection closed') );
    // }
}


let root = null; // cached
function btc(){
    if (!root) {
        root = item();
        root.item('wallet').ChildClass = WalletItem;
    }
    return root;
}

export function wallets(){ return btc().item('wallet'); }

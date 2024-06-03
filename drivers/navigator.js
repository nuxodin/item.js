import {item} from '../item.js';

let root = null;
export function store(){
    if (!root) {
        root = item();
        root.item('online').$get = function(){
            if (!this.filled) {
                addEventListener('online', () => this.set(true));
                addEventListener('offline', () => this.set(false));
                this.set(navigator.onLine);
            }
            return navigator.onLine;
        }

        root.item('geolocation').item('latitude').$get = function(){
            if (!this.filled) return geo().then(geo => geo.latitude);
            return geovalues.latitude;
        }
        root.item('geolocation').item('longitude').$get = function(){
            if (!this.filled) return geo().then(geo => geo.longitude);
        }
        root.item('geolocation').item('accuracy').$get = function(){
            if (!this.filled) return geo().then(geo => geo.accuracy);
        }

    }
    return root;
}

let geowatcher = null;
let geopromise = null;
let geovalues = null;
function geo(){
    if (!geowatcher) {
        function onSuccess(position) {
            geovalues = position.coords;
            root.item('geolocation').set(position.coords);
        }
        function onError(error) { }
        const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
        geowatcher = navigator.geolocation.watchPosition(onSuccess, onError, options);
    }
    if (!geopromise) {
        geopromise = new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(function(data){
                resolve(data.coords)
            }, reject);
        });
    }
    return geopromise;
}

console.log(store().item('online'));

// ussage
// const online = store().item('online');
// effect(() => {
//     console.log('online', online.value);
// });
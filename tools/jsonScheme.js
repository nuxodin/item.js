
class jsonScheme {
    constructor(scheme) {
        this.scheme = scheme;
    }
    validate(data) {
        switch (this.scheme.type) {
            case 'string':
                return typeof data === 'string';
            case 'integer':
                return Number.isInteger(data);
            case 'number':
                return typeof data === 'number';
            case 'boolean':
                return typeof data === 'boolean';
            case 'object':
                if (this.scheme.properties) {
                    for (const key in this.scheme.properties) {
                        if (!this.scheme.properties.hasOwnProperty(key)) continue;
                        if (!this.validate(data[key])) return false;
                    }
                }
                return true;
            case 'array':
                if (!Array.isArray(data)) return false;
                if (this.scheme.items) {
                    for (const item of data) {
                        if (!this.validate(item)) return false;
                    }
                }
                return true;
            default:
                return false;
        }



    }



}
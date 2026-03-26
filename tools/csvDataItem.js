import { item } from '../item.js';

/**
 * Bidirectional sync between Item and CSV format
 * Lightweight CSV parser/stringifier (no dependencies)
 * Similar to jsonDataItem but for CSV files
 * 
 * Features:
 * - Auto-sync Item → CSV (debounced)
 * - Auto-sync CSV file → Item (on file change)
 * - Headers from first row
 * - Array of objects structure
 */
export async function csvDataItem(csvItem, options = {}) {
    const {
        delimiter = ',',
        columns = null, // auto-detect if null
        keyColumn = null, // if set, use this column as item key
    } = options;

    const root = item();

    // Parse CSV string to array of objects
    const parseCsv = (csv) => {
        if (!csv || !csv.trim()) return [];
        
        const lines = csv.trim().split(/\r?\n/);
        if (lines.length === 0) return [];
        
        // Parse a single line respecting quotes
        const parseLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        current += '"';
                        i++; // Skip next quote
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === delimiter && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };
        
        // Get headers
        const csvHeaders = columns || parseLine(lines[0]);
        const dataStart = columns ? 0 : 1;
        
        // Parse data rows
        return lines.slice(dataStart).map((line, index) => {
            const values = parseLine(line);
            const row = {};
            csvHeaders.forEach((h, i) => {
                row[h] = values[i] ?? '';
            });
            return row;
        });
    };

    // Convert array of objects to CSV string
    const stringifyCsv = (data) => {
        if (!Array.isArray(data) || data.length === 0) {
            return columns ? columns.join(delimiter) + '\n' : '';
        }
        
        const cols = columns || Object.keys(data[0]);
        
        // Escape values containing delimiter, quotes, or newlines
        const escapeValue = (val) => {
            const str = String(val ?? '');
            if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };
        
        const lines = [
            cols.join(delimiter),
            ...data.map(row => cols.map(c => escapeValue(row[c])).join(delimiter))
        ];
        
        return lines.join('\n');
    };

    // Sync from CSV to Item
    const syncFromCsv = (csv) => {
        const data = parseCsv(csv);
        
        // Clear existing
        for (const child of [...root.items()]) child.remove();
        
        // Set new data
        data.forEach((row, index) => {
            const key = keyColumn ? row[keyColumn] : String(index);
            if (key !== undefined && key !== null) {
                root.item(String(key)).set(row);
            }
        });
    };

    // Sync from Item to CSV
    const syncToCsv = () => {
        const data = [...root.items()].map(child => child.value);
        const csv = stringifyCsv(data);
        csvItem.set(csv);
    };

    // Initial sync
    syncFromCsv(await csvItem.read());

    // Item → CSV (debounced)
    root.addEventListener('changeIn', debounce(syncToCsv, 100));

    // CSV → Item (on external change)
    csvItem.addEventListener('change', () => syncFromCsv(csvItem.value));

    return root;
}

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

/**
 * Tests for convertible content filtering
 * Ensures the extension doesn't process text that doesn't contain convertible content
 */

// Mock the global objects that would be available in the browser extension context
global.cryptoCurrencies = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'XRP': 'ripple',
    'LTC': 'litecoin',
    'DOGE': 'dogecoin',
    'ADA': 'cardano'
};

global.currencySymbols = {
    'EUR': '€',
    'USD': '$',
    'GBP': '£',
    'JPY': '¥',
    'BGN': 'лв'
};

// Load the content script functions
const fs = require('fs');
const path = require('path');
const contentScript = fs.readFileSync(path.join(__dirname, '../js/content.js'), 'utf8');

// Extract the hasConvertibleContent function
const hasConvertibleContentMatch = contentScript.match(/function hasConvertibleContent\(text\) \{[\s\S]*?\n\}/);
if (!hasConvertibleContentMatch) {
    throw new Error('hasConvertibleContent function not found in content.js');
}

// Evaluate the function in the current context
eval(hasConvertibleContentMatch[0]);

describe('Convertible Content Filter', () => {
    describe('hasConvertibleContent', () => {
        test('should return false for plain text without convertible content', () => {
            expect(hasConvertibleContent('Hello world')).toBe(false);
            expect(hasConvertibleContent('This is just regular text')).toBe(false);
            expect(hasConvertibleContent('Lorem ipsum dolor sit amet')).toBe(false);
            expect(hasConvertibleContent('JavaScript programming tutorial')).toBe(false);
            expect(hasConvertibleContent('The quick brown fox jumps')).toBe(false);
        });

        test('should return true for cryptocurrency symbols', () => {
            expect(hasConvertibleContent('BTC')).toBe(true);
            expect(hasConvertibleContent('ETH price today')).toBe(true);
            expect(hasConvertibleContent('I bought some DOGE')).toBe(true);
            expect(hasConvertibleContent('bitcoin is rising')).toBe(true);
            expect(hasConvertibleContent('ethereum network')).toBe(true);
        });

        test('should return true for fiat currency symbols and codes', () => {
            expect(hasConvertibleContent('USD')).toBe(true);
            expect(hasConvertibleContent('EUR exchange rate')).toBe(true);
            expect(hasConvertibleContent('$100')).toBe(true);
            expect(hasConvertibleContent('€50')).toBe(true);
            expect(hasConvertibleContent('£25')).toBe(true);
            expect(hasConvertibleContent('¥1000')).toBe(true);
        });

        test('should return true for time zone abbreviations', () => {
            expect(hasConvertibleContent('5 PM PST')).toBe(true);
            expect(hasConvertibleContent('Meeting at 2:00 EST')).toBe(true);
            expect(hasConvertibleContent('10:30 GMT')).toBe(true);
            expect(hasConvertibleContent('Conference call UTC')).toBe(true);
        });

        test('should return true for unit measurements', () => {
            expect(hasConvertibleContent('5 miles')).toBe(true);
            expect(hasConvertibleContent('100 kg')).toBe(true);
            expect(hasConvertibleContent('32°F')).toBe(true);
            expect(hasConvertibleContent('2 cups flour')).toBe(true);
            expect(hasConvertibleContent('60 mph')).toBe(true);
            expect(hasConvertibleContent('10 inches')).toBe(true);
        });

        test('should return true for number + unit patterns', () => {
            expect(hasConvertibleContent('25lb')).toBe(true);
            expect(hasConvertibleContent('100km')).toBe(true);
            expect(hasConvertibleContent('50°')).toBe(true);
            expect(hasConvertibleContent('1000$')).toBe(true);
        });

        test('should return false for numbers without units', () => {
            expect(hasConvertibleContent('123')).toBe(false);
            expect(hasConvertibleContent('45.67')).toBe(false);
            expect(hasConvertibleContent('1,000,000')).toBe(false);
        });

        test('should handle words containing unit substrings correctly', () => {
            expect(hasConvertibleContent('cup of coffee')).toBe(true); // This should be true because 'cup' is a unit
            expect(hasConvertibleContent('football')).toBe(false); // This should be false because 'ft' is not a word boundary
            expect(hasConvertibleContent('example')).toBe(false);
            expect(hasConvertibleContent('important')).toBe(false);
            expect(hasConvertibleContent('5 ft tall')).toBe(true); // This should be true because 'ft' is a separate word
        });

        test('should handle empty and whitespace-only strings', () => {
            expect(hasConvertibleContent('')).toBe(false);
            expect(hasConvertibleContent('   ')).toBe(false);
            expect(hasConvertibleContent('\n\t')).toBe(false);
        });

        test('should be case insensitive', () => {
            expect(hasConvertibleContent('btc')).toBe(true);
            expect(hasConvertibleContent('usd')).toBe(true);
            expect(hasConvertibleContent('pst')).toBe(true);
            expect(hasConvertibleContent('KG')).toBe(true);
        });
    });
});
/**
 * Jest setup file for browser extension tests
 */

// Mock browser APIs that might be used in the extension
global.chrome = {
    storage: {
        sync: {
            get: jest.fn(),
            set: jest.fn()
        },
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    }
};

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};
global.localStorage = localStorageMock;

// Mock console methods to reduce test noise
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Mock Date.now for consistent testing
const originalDateNow = Date.now;
global.mockDateNow = (timestamp) => {
    Date.now = jest.fn(() => timestamp);
};

global.restoreDateNow = () => {
    Date.now = originalDateNow;
};

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
    global.restoreDateNow();
});
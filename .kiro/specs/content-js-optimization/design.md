# Design Document

## Overview

This design document outlines the architectural approach for optimizing the monolithic content.js file structure while preserving the single-file architecture. The optimization focuses on internal code organization, performance improvements, and maintainability enhancements without changing the external behavior or user experience.

The design maintains the existing functionality while introducing logical groupings, performance optimizations, and better error handling patterns. All changes are internal refactoring that improves code quality without affecting the extension's behavior from a user perspective.

## Architecture

The optimized content.js will maintain its monolithic structure but with clear internal organization:

```
content.js (Single File)
├── Configuration & Constants
├── Utility Functions  
├── Data Services
├── Business Logic
├── UI Components
├── Event Handlers
└── Initialization
```

### Key Architectural Principles

1. **Logical Separation**: Code organized into clear functional sections
2. **Object-Oriented Grouping**: Related functions consolidated into utility objects
3. **Performance-First**: Optimizations for DOM queries, event handling, and memory usage
4. **Error Resilience**: Centralized error handling with graceful degradation
5. **Maintainability**: Consistent patterns and clear interfaces

## Components and Interfaces

### 1. Configuration Management

```javascript
const CONFIG = {
    MAX_SELECTION_LENGTH: 7000,
    MIN_SELECTION_LENGTH: 2,
    HIDE_DELAY: 3000,
    CACHE_DURATION: 24 * 60 * 60 * 1000,
    CRYPTO_CACHE_DURATION: 5 * 60 * 1000
};

const REGEX_PATTERNS = {
    valueUnit: /^(-?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?|\d+\/\d+)\s*([a-zA-Z°/€$£¥₺₽₹₩₪₱฿₣₦₲₵₡₫₭₮₯₠₢₳₴₸₼₾₿]+|[a-zA-Z]+(?:\s+[a-zA-Z]+)*)[.,;:!?]*$/i,
    unitValue: /^([a-zA-Z°/€$£¥₺₽₹₩₪₱฿₣₦₲₵₡₫₭₮₯₠₢₳₴₸₼₾₿]+|[a-zA-Z]+(?:\s+[a-zA-Z]+)*)\s*(-?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?|\d+\/\d+)[.,;:!?]*$/i,
    url: /^(https?:\/\/)?(([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)(\/[^\s]*)?$/,
    timeZone: /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\s*([A-Z]{2,5})$/i
};
```

### 2. State Management System

```javascript
const AppState = {
    selection: {
        text: '',
        isUrl: false,
        convertedValue: null
    },
    api: {
        exchangeRatesError: null,
        cryptoRatesError: null,
        apiCallAttempts: 0
    },
    preferences: {
        currency: 'BGN',
        cryptoCurrency: 'USD',
        searchEngine: 'google'
    },
    ui: {
        hidePopupTimeout: null,
        isSelectionComplete: false
    },
    
    update(section, key, value) {
        if (this[section]) {
            this[section][key] = value;
        }
    },
    
    reset() {
        this.selection.text = '';
        this.selection.isUrl = false;
        this.selection.convertedValue = null;
    }
};
```

### 3. Performance Utilities

```javascript
const PerformanceUtils = {
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    debounce(func, delay) {
        let timeoutId;
        return function() {
            const args = arguments;
            const context = this;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        };
    }
};
```

### 4. DOM Management System

```javascript
const DOMCache = {
    searchButton: null,
    copyButton: null,
    conversionContainer: null,
    errorContainer: null,
    
    init() {
        this.searchButton = shadowRoot.getElementById('extensionSearchButton');
        this.copyButton = shadowRoot.getElementById('extensionCopyButton');
        this.conversionContainer = shadowRoot.getElementById('conversionContainer');
        this.errorContainer = shadowRoot.getElementById('errorContainer');
    },
    
    get(elementName) {
        return this[elementName];
    }
};

const DOMBuilder = {
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        Object.assign(element, attributes);
        children.forEach(child => {
            if (typeof child === 'string') {
                element.textContent = child;
            } else {
                element.appendChild(child);
            }
        });
        return element;
    },
    
    createPopupStructure() {
        // Optimized popup creation using helper methods
    }
};
```

### 5. Theme Detection System

```javascript
const ThemeUtils = {
    isEffectivelyTransparent(colorString) {
        // Existing logic consolidated
    },
    
    getEffectiveBackgroundColor(element) {
        // Existing logic consolidated
    },
    
    isColorDark(colorString) {
        // Existing logic consolidated
    },
    
    detectAndApplyTheme(popup, selectionElement, isPopupBelow) {
        const bgColor = this.getEffectiveBackgroundColor(selectionElement);
        const isDark = this.isColorDark(bgColor);
        this.applyThemeAndArrow(popup, isDark, isPopupBelow);
        return { isDark, bgColor };
    },
    
    applyThemeAndArrow(popup, isPageDark, isPopupBelowSelection) {
        // Existing logic consolidated
    }
};
```

### 6. Conversion Engine

```javascript
const ConversionEngine = {
    units: {
        // Consolidated unit conversion data
    },
    
    currencies: {
        // Currency conversion data
    },
    
    crypto: {
        // Cryptocurrency data
    },
    
    async convert(text) {
        return await this.tryTimeZone(text) || 
               await this.tryCrypto(text) || 
               await this.tryUnits(text) || 
               null;
    },
    
    tryTimeZone(text) {
        // Optimized timezone conversion logic
    },
    
    tryCrypto(text) {
        // Optimized crypto conversion logic
    },
    
    tryUnits(text) {
        // Optimized unit conversion logic
    }
};
```

### 7. Event Management System

```javascript
const EventManager = {
    init() {
        this.bindEvents();
    },
    
    bindEvents() {
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        window.addEventListener('scroll', this.throttledScrollHandler, { passive: true });
        window.addEventListener('resize', this.debouncedResizeHandler, { passive: true });
    },
    
    handleMouseUp(e) {
        // Consolidated mouseup logic
    },
    
    handleMouseDown(e) {
        // Consolidated mousedown logic
    },
    
    throttledScrollHandler: null, // Will be assigned throttled function
    debouncedResizeHandler: null  // Will be assigned debounced function
};
```

### 8. Error Handling System

```javascript
const ErrorHandler = {
    logError(context, error) {
        console.error(`[SearchPopup] ${context}:`, error);
    },
    
    handleAPIError(service, error) {
        this.logError(`${service} API`, error);
        return `Could not fetch ${service} data. Please try again later.`;
    },
    
    handleDOMError(operation, error) {
        this.logError(`DOM ${operation}`, error);
        // Graceful degradation
    },
    
    handleInitializationError(error) {
        this.logError('Initialization', error);
        // Fallback initialization
    }
};
```

## Data Models

### State Structure
```javascript
{
    selection: {
        text: string,
        isUrl: boolean,
        convertedValue: object | null
    },
    api: {
        exchangeRatesError: string | null,
        cryptoRatesError: string | null,
        apiCallAttempts: number
    },
    preferences: {
        currency: string,
        cryptoCurrency: string,
        searchEngine: string
    },
    ui: {
        hidePopupTimeout: number | null,
        isSelectionComplete: boolean
    }
}
```

### Conversion Result Model
```javascript
{
    original: string,
    converted: string,
    value: number
}
```

### Cache Models
```javascript
// Exchange Rates Cache
{
    lastUpdated: number,
    rates: {
        [currency: string]: number
    }
}

// Crypto Rates Cache
{
    lastUpdated: number,
    prices: {
        [coinId: string]: {
            [currency: string]: number
        }
    }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Functional Preservation
*For any* existing extension functionality (unit conversion, theme detection, popup positioning, API integrations, UI interactions), the refactored code should produce identical results to the original implementation
**Validates: Requirements 2.4, 10.1, 10.2, 10.3, 10.4, 10.5**

### Property 2: Event Throttling Effectiveness
*For any* high-frequency event (scroll, resize), when triggered rapidly, the throttled handler should not execute more frequently than the specified throttle limit
**Validates: Requirements 3.2, 6.3**

### Property 3: State Management Consistency
*For any* state update or reset operation, the state should change to the expected values and remain consistent across all access methods
**Validates: Requirements 4.2, 4.4, 4.5**

### Property 4: Error Handling Robustness
*For any* error condition (API failures, DOM operation failures), the system should log appropriate error messages, display user-friendly feedback, and continue functioning without crashes
**Validates: Requirements 5.2, 5.3, 5.4, 5.5**

### Property 5: Event Management Reliability
*For any* event binding or unbinding operation, the event listeners should be correctly attached or removed and respond appropriately to triggered events
**Validates: Requirements 6.5**

### Property 6: Shadow DOM Encapsulation
*For any* Shadow DOM creation, the shadow root should be properly encapsulated with styles contained within the shadow boundary
**Validates: Requirements 7.5**

### Property 7: Initialization Sequence Correctness
*For any* initialization process, the steps should complete in the correct order (preferences → UI → events → data), handle errors gracefully, provide appropriate feedback, and maintain all existing functionality
**Validates: Requirements 8.2, 8.3, 8.4, 8.5**

### Property 8: Utility Function Correctness
*For any* utility function (throttle, debounce, DOMBuilder, clipboard helpers), the function should work correctly according to its specification and maintain pure function characteristics where applicable
**Validates: Requirements 9.1, 9.2, 9.4, 9.5**

## Error Handling

The optimized content.js implements comprehensive error handling through the centralized ErrorHandler system:

### Error Categories
1. **API Errors**: Network failures, invalid responses, rate limiting
2. **DOM Errors**: Element not found, permission denied, cross-origin issues
3. **Initialization Errors**: Missing dependencies, configuration failures
4. **Runtime Errors**: Unexpected exceptions, type errors

### Error Handling Strategy
- **Graceful Degradation**: Continue operation with reduced functionality when possible
- **User-Friendly Messages**: Display helpful error messages instead of technical details
- **Comprehensive Logging**: Log detailed error information for debugging
- **Fallback Mechanisms**: Provide alternative approaches when primary methods fail

### Error Recovery
- **Retry Logic**: Implement exponential backoff for API calls
- **Cache Fallback**: Use cached data when fresh data is unavailable
- **Default Values**: Provide sensible defaults when configuration fails
- **Progressive Enhancement**: Core functionality works even if advanced features fail

## Testing Strategy

The testing approach combines unit tests for specific functionality with property-based tests for comprehensive coverage:

### Unit Testing Focus
- **Specific Examples**: Test concrete scenarios with known inputs and outputs
- **Edge Cases**: Test boundary conditions, empty inputs, invalid data
- **Integration Points**: Test interactions between different components
- **Error Conditions**: Test specific error scenarios and recovery mechanisms

### Property-Based Testing Focus
- **Universal Properties**: Test properties that should hold across all valid inputs
- **Comprehensive Coverage**: Generate many random test cases automatically
- **Regression Prevention**: Ensure refactoring doesn't break existing behavior
- **Performance Validation**: Verify optimization improvements work correctly

### Testing Configuration
- **Minimum 100 iterations** per property test for statistical confidence
- **Test tagging** with format: **Feature: content-js-optimization, Property {number}: {property_text}**
- **Dual approach**: Both unit tests and property tests are required for comprehensive coverage
- **Framework**: Use Jest for unit testing and fast-check for property-based testing

### Test Categories
1. **Functional Preservation Tests**: Verify all existing features work identically
2. **Performance Tests**: Validate throttling, debouncing, and optimization improvements
3. **State Management Tests**: Ensure state updates and resets work correctly
4. **Error Handling Tests**: Verify graceful error handling and recovery
5. **Initialization Tests**: Test startup sequence and error recovery
6. **Utility Function Tests**: Validate helper functions and pure function properties

The testing strategy ensures that the refactoring maintains all existing functionality while validating that the optimizations work as intended.
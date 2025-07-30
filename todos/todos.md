🔥 **CRITICAL PRIORITY**
*   **Architecture & Setup**
    *   **[ITEM]** - **Refactor the monolithic `content.js` into modules.** The current `content.js` file is over 800 lines long and handles everything from DOM manipulation and UI logic to API calls and business logic for conversions. This makes it difficult to maintain, debug, and test.
        *   **Rationale:** Breaking it down into smaller, focused modules (e.g., `ui.js`, `api.js`, `conversions.js`, `main.js`) will improve code organization, reduce coupling, and make the codebase much easier to manage and scale.
        *   **Impact:** High
        *   **Effort:** 2-3 Days
        *   **Dependencies:** None
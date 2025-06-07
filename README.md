# Text Selection Popup Extension
A extension inspired by Opera Browser's own popup menu that displays a convenient popup menu when you select text on a webpage, allowing you to quickly search or copy the selected text. In mine version the popup intelligently adapts its theme (light/dark) based on the underlying webpage's background.

## Features
**Contextual Popup:** Appears when text is selected on any webpage.
**Quick Actions:**
    * **Search:** Opens a new Google search tab with the selected text.
    * **Copy:** Copies the selected text to the clipboard.
**Adaptive Theming:** Automatically switches between a light and dark theme to match the webpage's background, ensuring readability.
![image](img/light.png)

**Auto-detecting websites in selected text**
![image](img/dark.png)


**Unit conversion** Convert between the most common units like kg lb mph km etc.
**Currency conversion** Convert between the most common currencies like USD EUR GBP etc.

**TODO:**
Make the extension pick the default search engine and/or add settings page with manual selection
Add option to pick Favourite currency or detect it.
Time zone conversion



**More features**
    * **Dynamic Positioning:** The popup positions itself intelligently above or below the selected text, with an arrow indicating the selection.
    * **Scroll & Resize Handling:** The popup disappears smoothly on page scroll or window resize to prevent obstruction.
    * **Lightweight & Efficient:** Designed to be unobtrusive and performant.

## Installation

To install this extension in Google Chrome:

1.  **Download the Extension Files:**
    * Clone the repo or download it and extract the zip file.

2.  **Open Chrome Extensions Page:**
    * Open Google Chrome.
    * Type `chrome://extensions` in the address bar and press Enter.

3.  **Enable Developer Mode:**
    * In the top right corner of the Extensions page, toggle the "Developer mode" switch to the **on** position.

4.  **Load Unpacked Extension:**
    * Click the "Load unpacked" button that appears on the left side.
    * Navigate to the folder where you saved the extension files (the folder containing `manifest.json` and `content.js`).
    * Select the folder and click "Select Folder".

5.  **Extension Installed:**
    * The "Text Selection Popup" extension should now appear in your list of installed extensions and be active.

Similar steps can be used for other Chromium based browsers.

---

!A portion of this app was created using various AI tools!

## Extension Tested on the following browsers:
Vivaldi 7.4
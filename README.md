# Search Popup Extension - Smart Text Selection Assistant

A blazing-fast browser extension that revolutionizes how you interact with text on any webpage. Select any text and instantly get a context-aware popup with smart actions: search, copy, convert units/currencies, visit URLs, and more. Built with cutting-edge performance optimizations including advanced DOM caching, pre-compiled regex patterns, and automatic memory management for zero-lag operation. The extension intelligently adapts its theme (light/dark) to match any website design.

## Features

### **Smart Text Actions**
- **Instant Search:** Select any text and search Google, DuckDuckGo, Bing, or your preferred engine
- **Quick Copy:** One-click copy to clipboard with intelligent fallback handling
- **URL Detection:** Automatically detects links and offers to visit them directly
- **Unit Conversion:** Real-time conversion of weights, temperatures, speeds, distances, and more
- **Currency & Crypto:** Live exchange rates for 100+ currencies and major cryptocurrencies
- **Time Zone Conversion:** Convert any time zone to your local time instantly

### **Performance Optimized**
- **Zero-Lag Operation:** Advanced DOM caching and pre-compiled regex patterns
- **Memory Efficient:** Automatic cleanup with WeakMap - no memory leaks
- **Batch DOM Operations:** Uses DocumentFragment for lightning-fast rendering
- **Smart Caching:** Exchange rates cached daily for instant offline conversions

### **Intelligent Design**
- **Adaptive Theming:** Automatically switches between light/dark mode based on page background
- **Smart Positioning:** Popup appears above/below selection with directional arrow
- **Viewport Aware:** Always stays within screen boundaries
- **Smooth Animations:** Elegant fade transitions and micro-interactions

### **Privacy & Security**
- **Local Processing:** All conversions happen locally - no data sent to external servers
- **Minimal Permissions:** Only requests clipboard write and storage access
- **Secure Links:** All external links open with `noopener,noreferrer` for security

![Light mode popup](img/light.png)
![Dark mode popup](img/dark.png)
![Unit conversion example](img/unit1.png)

## Supported Conversions

The extension supports a wide range of unit and currency conversions. Simply select the text (e.g., `10 lbs` or `0.5 BTC`) to see the result.

### General Units

| Category      | Example From                                      | To          |
|---------------|---------------------------------------------------|-------------|
| **Weight**    | `10 lb`, `5 kg`, `8 oz`, `500 g`                    | `kg`, `lb`, `g`, `oz` |
| **Temperature**| `68 °F`, `20 °C`                                  | `°C`, `°F`    |
| **Speed**     | `60 mph`, `100 km/h`, `30 mpg`, `8 l/100km`         | `km/h`, `mph`, `l/100km`, `mpg` |
| **Volume**    | `5 gal`, `20 l`, `2 qt`, `12 fl`, `250 ml`          | `l`, `gal`, `l`, `ml`, `fl` |
| **Distance**  | `10 mi`, `15 km`, `50 yd`, `100 m`, `10 ft`, `10 nmi` | `km`, `mi`, `m`, `yd`, `m`, `km` |
| **Power**     | `150 kW`, `200 hp`                                | `hp`, `kW`    |
| **Torque**    | `150 lb ft`, `200 Nm`                             | `Nm`, `lb ft` |

### Cooking Measurements

| Example From                                                              | To   |
|---------------------------------------------------------------------------|------|
| `1.5 cup`, `2 tbsp`, `0.5 tsp`, `8 fl oz`, `1 pint`, `1 quart`, `1 gallon` | `ml` |

### Time Zone Conversion Examples

| Example         | Description                        | Output Example           |
|----------------|------------------------------------|-------------------------|
| `5 PM PST`     | 12-hour US Pacific Time            | `03:00 (your time)`     |
| `14:00 EST`    | 24-hour US Eastern Time            | `21:00 (your time)`     |
| `11:30 am CET` | 12-hour Central European Time      | `12:30 (your time)`     |
| `23:15 GMT`    | 24-hour Greenwich Mean Time        | `01:15 (your time)`     |
| `8:00 UTC`     | 24-hour Coordinated Universal Time | `11:00 (your time)`     |
| `10:00pm PT`     | 12-hour America/Los_Angeles | `08:00 (your time)`     |

### Fiat Currency Examples

| Example           | Description                        |
|-------------------|------------------------------------|
| `3,000 yen`       | Japanese Yen by name      |
| `10 dollars`      | US Dollars by name        |
| `1,600,000 TRY`    | Turkish Lira with thousands comma   |
| `569,00€`         | Euro with comma decimal             |
| `569.00€`         | Euro with dot decimal               |
| `$1,234.56`       | US Dollar with comma thousands      |
| `1.234,56 USD`    | US Dollar with dot thousands, comma decimal |
| `£2,000`          | British Pound with thousands comma  |
| `100 BGN`         | Bulgarian Lev                      |
| `¥10,000`         | Japanese Yen                       |
| `₹5,00,000`       | Indian Rupee (lakh format)          |
| `€5.00,000`       | Euro with comma and dot         |
| `10 USD`          | US Dollar plain                    |
| `20 EUR`          | Euro plain                         |
| `50 GBP`          | British Pound plain                |

### Cryptocurrencies

All cryptocurrency conversions are fetched from the CoinGecko API and converted to `USD`. Just select the amount and symbol (e.g., `0.5 BTC`).

| Example | Name | Example | Name |
|--------------|-----------------|--------------|---------------|
| `1 BTC` | Bitcoin | `1.5 ETH` | Ethereum |
| `50 XRP` | Ripple | `10 LTC` | Litecoin |
| `2.1 BCH` | Bitcoin Cash | `30.05 DOT` | Polkadot |
| `50 LINK` | Chainlink | `1000 XLM` | Stellar |
| `5 BNB` | Binance Coin | `200 EOS` | EOS |
| `0.5 YFI` | Yearn.finance | `13 XAG` | `1,44 XAU` |
| `20 BITS` | `250 SATS` | | |


## Installation

**From Chrome web store:**

https://chromewebstore.google.com/detail/search-popup/plaekmbmccfiagpfodadmohfmmbkblam

**Manual installation:**

1. **Download the Extension Files:**
   - Clone or download and extract the repo.
2. **Open Chrome Extensions Page:**
   - Go to `chrome://extensions` in your browser.
3. **Enable Developer Mode:**
   - Toggle "Developer mode" on (top right).
4. **Load Unpacked Extension:**
   - Click "Load unpacked" and select the folder containing `manifest.json`.
5. **Done!**
   - The extension is now active and ready to use.

Works on all Chromium-based browsers (Chrome, Vivaldi, Edge, Brave, etc.).

---

## Advanced Features

### Performance Engineering
- **Zero-Lag DOM Operations:** Advanced caching system with pre-compiled regex patterns
- **Memory Optimization:** Automatic cleanup with WeakMap references - no memory leaks
- **Batch Rendering:** DocumentFragment operations for lightning-fast UI updates
- **Smart Throttling:** Event handling optimized to prevent performance bottlenecks

### Security & Privacy
- **Local Processing:** All conversions happen on your device - no data sent to external servers
- **Secure External Links:** All `window.open()` calls use `noopener,noreferrer` protection
- **Minimal Permissions:** Only requests essential permissions (clipboard write, storage)
- **No Tracking:** No analytics, telemetry, or data collection

### Smart Data Handling
- **Exchange Rate Caching:** Rates cached daily for instant offline conversions
- **Locale-Aware Parsing:** Handles both `1,234.56` and `1.234,56` number formats
- **Robust Clipboard:** Modern Clipboard API with intelligent fallback handling
- **Error Resilience:** Graceful handling of network failures and API errors

---

*Portions of this app were created using various AI tools!*

## Developed and tested on
- Vivaldi Browser

Other Chromium browsers should work as well.
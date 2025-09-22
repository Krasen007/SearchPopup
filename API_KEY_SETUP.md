# CoinGecko API Key Setup

The Search Popup extension now supports CoinGecko API keys for improved reliability and performance when converting currencies and cryptocurrencies.

## Recent Fix: Currency Conversion Accuracy

**Issue Fixed**: Currency conversions to BGN (and other preferred currencies) now show correct exchange rates.

**What was wrong**: The previous implementation was using Bitcoin-relative exchange rates incorrectly, causing inaccurate currency conversions.

**What was fixed**: 
- Updated to use Bitcoin prices in multiple currencies to calculate proper cross-exchange rates
- Fixed conversion logic to properly convert between any two fiat currencies
- Ensured rates are calculated relative to USD as an intermediate currency for accuracy

## Why Use an API Key?

- **Better Reliability**: Direct API access without proxy limitations
- **Higher Rate Limits**: 10,000 requests/month vs limited free tier
- **Improved Performance**: Faster response times and better accuracy
- **More Stable**: Reduced chance of conversion failures

## How to Get Your Free API Key

1. **Visit CoinGecko**: Go to [coingecko.com/en/api](https://www.coingecko.com/en/api)
2. **Sign Up**: Create a free account (no credit card required)
3. **Get Your Key**: Copy your API key from the dashboard
4. **Configure Extension**: 
   - Right-click the extension icon
   - Select "Options" or "Settings"
   - Paste your API key in the "CoinGecko API Key" field
   - Click "Save Settings"

## Default Behavior (No API Key)

The extension works without an API key using CoinGecko's free tier:
- Limited rate limits
- May experience occasional failures
- Uses proxy servers for CORS compatibility
- Still provides currency conversion functionality

## API Key Benefits

With a configured API key:
- Direct API access (no proxies needed)
- 10,000 requests per month
- Better error handling and retry logic
- More reliable cryptocurrency price data
- Faster cache loading at startup

## Troubleshooting

### "Invalid API Key" Error
- Check that you copied the full API key
- Ensure there are no extra spaces
- Verify the key is from CoinGecko (not another service)

### "API Key Test Failed"
- Check your internet connection
- Verify the API key is active in your CoinGecko account
- Try again in a few minutes (temporary rate limiting)

### Extension Still Uses Free Tier
- Make sure you clicked "Save Settings" after entering the key
- Reload any open tabs to apply changes
- Check browser console for any error messages

## Privacy & Security

- Your API key is stored locally in your browser
- The key is only sent to CoinGecko's official API
- No third parties have access to your API key
- You can remove the key anytime in settings

## Support

If you encounter issues:
1. Try the "Test API Key" button in settings
2. Check the browser console for error messages
3. Report issues on [GitHub](https://github.com/Krasen007/SearchPopup/issues)

---

**Note**: The extension will continue to work without an API key, but configuring one provides the best experience for currency conversions.
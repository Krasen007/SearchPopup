const currencies = [
  "USD",
  "AED",
  "ARS",
  "AUD",
  "BDT",
  "BHD",
  "BMD",
  "BRL",
  "CAD",
  "CHF",
  "CLP",
  "CNY",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "GEL",
  "HKD",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "JPY",
  "KRW",
  "KWD",
  "LKR",
  "MMK",
  "MXN",
  "MYR",
  "NGN",
  "NOK",
  "NZD",
  "PHP",
  "PKR",
  "PLN",
  "RUB",
  "SAR",
  "SEK",
  "SGD",
  "THB",
  "TRY",
  "TWD",
  "UAH",
  "VEF",
  "VND",
  "ZAR",
  "BGN",
];

// settings.js - for future settings logic

document.addEventListener("DOMContentLoaded", () => {
  const currencySelect = document.getElementById("currency-select");
  const cryptoCurrencySelect = document.getElementById(
    "crypto-currency-select",
  );
  const searchEngineSelect = document.getElementById("search-engine-select");
  const saveButton = document.getElementById("save-settings");
  const reloadMessage = document.querySelector(".reload-message");
  const versionValue = document.getElementById("version-value");

  // Function to populate a dropdown with a list of currencies
  function populateCurrencyDropdown(selectElement, currencyList) {
    currencyList.forEach((currency) => {
      const option = document.createElement("option");
      option.value = currency;
      option.textContent = currency;
      selectElement.appendChild(option);
    });
  }

  // Populate the currency and crypto-currency dropdowns
  populateCurrencyDropdown(currencySelect, currencies);
  populateCurrencyDropdown(cryptoCurrencySelect, currencies);

  // Set version from manifest
  if (
    versionValue &&
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.getManifest
  ) {
    const manifest = chrome.runtime.getManifest();
    if (manifest && manifest.version) {
      versionValue.textContent = manifest.version;
    }
  }

  // Hide reload message by default
  if (reloadMessage) reloadMessage.style.display = "none";

  // Load saved currency preferences and search engine
  chrome.storage.sync.get(
    ["preferredCurrency", "preferredCryptoCurrency", "preferredSearchEngine"],
    (result) => {
      if (result.preferredCurrency) {
        currencySelect.value = result.preferredCurrency;
      }
      if (cryptoCurrencySelect && result.preferredCryptoCurrency) {
        cryptoCurrencySelect.value = result.preferredCryptoCurrency;
      }
      if (searchEngineSelect && result.preferredSearchEngine) {
        searchEngineSelect.value = result.preferredSearchEngine;
      }
    },
  );

  // Save currency preferences and search engine
  saveButton.addEventListener("click", () => {
    const selectedCurrency = currencySelect.value;
    const selectedCryptoCurrency = cryptoCurrencySelect
      ? cryptoCurrencySelect.value
      : "USD";
    const selectedSearchEngine = searchEngineSelect
      ? searchEngineSelect.value
      : "google";
    chrome.storage.sync.set(
      {
        preferredCurrency: selectedCurrency,
        preferredCryptoCurrency: selectedCryptoCurrency,
        preferredSearchEngine: selectedSearchEngine,
      },
      () => {
        saveButton.textContent = "Saved!";
        if (reloadMessage) reloadMessage.style.display = "block";
        setTimeout(() => {
          saveButton.textContent = "Save";
        }, 3000);
      },
    );
  });
});

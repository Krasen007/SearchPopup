// settings.js - for future settings logic

document.addEventListener('DOMContentLoaded', () => {
    const currencySelect = document.getElementById('currency-select');
    const saveButton = document.getElementById('save-settings');

    // Load saved currency preference
    chrome.storage.sync.get(['preferredCurrency'], (result) => {
        if (result.preferredCurrency) {
            currencySelect.value = result.preferredCurrency;
        }
    });

    // Save currency preference
    saveButton.addEventListener('click', () => {
        const selectedCurrency = currencySelect.value;
        chrome.storage.sync.set({ preferredCurrency: selectedCurrency }, () => {
            saveButton.textContent = 'Saved!';
            setTimeout(() => { saveButton.textContent = 'Save'; }, 1000);
        });
    });
}); 
/**
 * CacheStatusDisplay - User interface components for cache status indicators
 * Provides loading indicators, freshness timestamps, staleness warnings, and error messages
 */
class CacheStatusDisplay {
    constructor(cacheManager, statusMonitor, options = {}) {
        if (!cacheManager) {
            throw new Error('CacheStatusDisplay requires a RateCacheManager instance');
        }
        if (!statusMonitor) {
            throw new Error('CacheStatusDisplay requires a CacheStatusMonitor instance');
        }

        this.cacheManager = cacheManager;
        this.statusMonitor = statusMonitor;
        
        // Configuration with defaults
        this.config = {
            showLoadingIndicator: options.showLoadingIndicator !== false, // Default true
            showTimestamps: options.showTimestamps !== false, // Default true
            showStalenessWarnings: options.showStalenessWarnings !== false, // Default true
            showErrorMessages: options.showErrorMessages !== false, // Default true
            autoHideDelay: options.autoHideDelay || 5000, // 5 seconds
            position: options.position || 'top-right', // top-right, top-left, bottom-right, bottom-left
            enableLogging: options.enableLogging !== false, // Default true
            compactMode: options.compactMode || false, // Compact display mode
            theme: options.theme || 'light' // light, dark, auto
        };

        // UI state
        this.currentNotification = null;
        this.loadingIndicator = null;
        this.statusBadge = null;
        this.isVisible = false;

        // Bind methods
        this.handleStatusChange = this.handleStatusChange.bind(this);
        this.handleStalenessChange = this.handleStalenessChange.bind(this);
        this.handleCriticalStaleness = this.handleCriticalStaleness.bind(this);

        // Set up event listeners
        this.setupEventListeners();

        // Initialize display
        this.initialize();
    }

    /**
     * Initialize the status display system
     */
    initialize() {
        this.log('Initializing cache status display');
        
        // Create initial status display
        this.updateStatusDisplay();
        
        // Set up periodic status updates
        this.startPeriodicUpdates();
    }

    /**
     * Set up event listeners for cache status changes
     */
    setupEventListeners() {
        this.statusMonitor.setOnStatusChange(this.handleStatusChange);
        this.statusMonitor.setOnStalenessChange(this.handleStalenessChange);
        this.statusMonitor.setOnCriticalStaleness(this.handleCriticalStaleness);
    }

    /**
     * Handle cache status changes
     * @param {Object} status - New cache status
     */
    handleStatusChange(status) {
        this.log('Cache status changed:', status);
        this.updateStatusDisplay(status);
    }

    /**
     * Handle staleness level changes
     * @param {Object} event - Staleness change event
     */
    handleStalenessChange(event) {
        this.log('Staleness level changed:', event);
        
        if (this.config.showStalenessWarnings) {
            this.showStalenessNotification(event);
        }
    }

    /**
     * Handle critical staleness events
     * @param {Object} event - Critical staleness event
     */
    handleCriticalStaleness(event) {
        this.log('Critical staleness detected:', event);
        
        if (this.config.showErrorMessages) {
            this.showCriticalStalenessAlert(event);
        }
    }

    /**
     * Update the main status display
     * @param {Object} status - Optional status object (will fetch if not provided)
     */
    updateStatusDisplay(status = null) {
        try {
            const currentStatus = status || this.statusMonitor.getDetailedStatus();
            
            // Update loading indicator
            if (this.config.showLoadingIndicator) {
                this.updateLoadingIndicator(currentStatus);
            }
            
            // Update status badge
            this.updateStatusBadge(currentStatus);
            
            // Update conversion result timestamps
            if (this.config.showTimestamps) {
                this.updateConversionTimestamps(currentStatus);
            }
            
        } catch (error) {
            this.log('Error updating status display:', error);
        }
    }

    /**
     * Update loading indicator based on cache status
     * @param {Object} status - Cache status
     */
    updateLoadingIndicator(status) {
        if (!status.isReady && !status.error) {
            this.showLoadingIndicator();
        } else {
            this.hideLoadingIndicator();
        }
    }

    /**
     * Show loading indicator during startup cache loading
     */
    showLoadingIndicator() {
        if (this.loadingIndicator) {
            return; // Already showing
        }

        this.loadingIndicator = this.createLoadingIndicator();
        document.body.appendChild(this.loadingIndicator);
        this.isVisible = true;
        
        this.log('Loading indicator shown');
    }

    /**
     * Hide loading indicator
     */
    hideLoadingIndicator() {
        if (this.loadingIndicator && this.loadingIndicator.parentElement) {
            this.loadingIndicator.remove();
            this.loadingIndicator = null;
            this.isVisible = false;
            
            this.log('Loading indicator hidden');
        }
    }

    /**
     * Create loading indicator element
     * @returns {HTMLElement} Loading indicator element
     */
    createLoadingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'cache-loading-indicator';
        indicator.style.cssText = this.getLoadingIndicatorStyles();
        
        indicator.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading exchange rates...</div>
            </div>
        `;
        
        // Add spinner animation styles
        const style = document.createElement('style');
        style.textContent = this.getLoadingSpinnerStyles();
        document.head.appendChild(style);
        
        return indicator;
    }

    /**
     * Get CSS styles for loading indicator
     * @returns {string} CSS styles
     */
    getLoadingIndicatorStyles() {
        const position = this.getPositionStyles();
        const theme = this.getThemeStyles();
        
        return `
            position: fixed;
            ${position}
            background: ${theme.background};
            color: ${theme.text};
            border: 1px solid ${theme.border};
            border-radius: 6px;
            padding: 12px 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            box-shadow: 0 4px 12px ${theme.shadow};
            z-index: 10000;
            max-width: 280px;
            backdrop-filter: blur(10px);
        `;
    }

    /**
     * Get CSS styles for loading spinner animation
     * @returns {string} CSS styles
     */
    getLoadingSpinnerStyles() {
        return `
            .cache-loading-indicator .loading-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .cache-loading-indicator .loading-spinner {
                width: 16px;
                height: 16px;
                border: 2px solid rgba(0, 123, 186, 0.2);
                border-top: 2px solid #007cba;
                border-radius: 50%;
                animation: cache-loading-spin 1s linear infinite;
            }
            
            @keyframes cache-loading-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .cache-loading-indicator .loading-text {
                font-weight: 500;
            }
        `;
    }

    /**
     * Update status badge with current cache information
     * @param {Object} status - Cache status
     */
    updateStatusBadge(status) {
        // Remove existing badge
        if (this.statusBadge && this.statusBadge.parentElement) {
            this.statusBadge.remove();
        }

        // Only show badge if there's something important to display
        if (status.isReady && !status.staleness.isStale && !status.error) {
            return; // No need to show badge for normal operation
        }

        this.statusBadge = this.createStatusBadge(status);
        document.body.appendChild(this.statusBadge);
    }

    /**
     * Create status badge element
     * @param {Object} status - Cache status
     * @returns {HTMLElement} Status badge element
     */
    createStatusBadge(status) {
        const badge = document.createElement('div');
        badge.className = 'cache-status-badge';
        badge.style.cssText = this.getStatusBadgeStyles(status);
        
        const content = this.getStatusBadgeContent(status);
        badge.innerHTML = content;
        
        // Add click handler for detailed status
        badge.addEventListener('click', () => {
            this.showDetailedStatus(status);
        });
        
        return badge;
    }

    /**
     * Get CSS styles for status badge
     * @param {Object} status - Cache status
     * @returns {string} CSS styles
     */
    getStatusBadgeStyles(status) {
        const position = this.getPositionStyles();
        const theme = this.getThemeStyles();
        const indicators = status.indicators || {};
        
        return `
            position: fixed;
            ${position}
            background: ${indicators.color || theme.background};
            color: white;
            border-radius: 12px;
            padding: 4px 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 9999;
            cursor: pointer;
            transition: all 0.2s ease;
            max-width: 120px;
            text-align: center;
        `;
    }

    /**
     * Get content for status badge
     * @param {Object} status - Cache status
     * @returns {string} HTML content
     */
    getStatusBadgeContent(status) {
        if (status.error) {
            return '⚠️ Error';
        }
        
        if (!status.isReady) {
            return '⏳ Loading';
        }
        
        if (status.staleness) {
            const badge = status.indicators?.badge || 'Stale';
            const icon = this.getStalenessIcon(status.staleness.level);
            return `${icon} ${badge}`;
        }
        
        return '✓ Ready';
    }

    /**
     * Get icon for staleness level
     * @param {string} level - Staleness level
     * @returns {string} Icon emoji
     */
    getStalenessIcon(level) {
        const icons = {
            fresh: '✓',
            stale: '⚠️',
            very_stale: '🔶',
            critical_stale: '🔴',
            no_data: '❌'
        };
        return icons[level] || '❓';
    }

    /**
     * Update conversion result timestamps
     * @param {Object} status - Cache status
     */
    updateConversionTimestamps(status) {
        // Find all conversion results on the page and add timestamps
        const conversionElements = document.querySelectorAll('.conversion-result, .crypto-conversion, .fiat-conversion');
        
        for (const element of conversionElements) {
            this.addTimestampToConversion(element, status);
        }
    }

    /**
     * Add timestamp information to a conversion result element
     * @param {HTMLElement} element - Conversion result element
     * @param {Object} status - Cache status
     */
    addTimestampToConversion(element, status) {
        // Remove existing timestamp
        const existingTimestamp = element.querySelector('.conversion-timestamp');
        if (existingTimestamp) {
            existingTimestamp.remove();
        }

        // Create new timestamp
        const timestamp = document.createElement('span');
        timestamp.className = 'conversion-timestamp';
        timestamp.style.cssText = this.getTimestampStyles(status);
        timestamp.textContent = this.getTimestampText(status);
        
        element.appendChild(timestamp);
    }

    /**
     * Get CSS styles for conversion timestamps
     * @param {Object} status - Cache status
     * @returns {string} CSS styles
     */
    getTimestampStyles(status) {
        const color = status.staleness?.isStale ? '#ff6b35' : '#666';
        
        return `
            display: block;
            font-size: 10px;
            color: ${color};
            margin-top: 2px;
            font-style: italic;
        `;
    }

    /**
     * Get timestamp text for conversion results
     * @param {Object} status - Cache status
     * @returns {string} Timestamp text
     */
    getTimestampText(status) {
        if (!status.isReady) {
            return 'Loading rates...';
        }
        
        if (status.error) {
            return 'Rate error';
        }
        
        const ageInfo = status.ageInfo;
        if (!ageInfo) {
            return 'No rate data';
        }
        
        let text = `Updated ${ageInfo.relativeTime}`;
        
        if (status.staleness?.isStale) {
            text += ' (stale)';
        }
        
        return text;
    }

    /**
     * Show staleness notification
     * @param {Object} event - Staleness change event
     */
    showStalenessNotification(event) {
        const notification = this.createNotification({
            type: 'warning',
            title: 'Exchange Rates Outdated',
            message: `Rates are ${event.staleness.description.toLowerCase()}`,
            action: 'Refreshing in background...',
            autoHide: true
        });
        
        this.showNotification(notification);
    }

    /**
     * Show critical staleness alert
     * @param {Object} event - Critical staleness event
     */
    showCriticalStalenessAlert(event) {
        const notification = this.createNotification({
            type: 'error',
            title: 'Exchange Rates Critically Outdated',
            message: event.staleness.description,
            action: 'Manual refresh recommended',
            autoHide: false,
            actions: [
                {
                    text: 'Refresh Now',
                    action: () => this.triggerManualRefresh()
                },
                {
                    text: 'Dismiss',
                    action: () => this.hideCurrentNotification()
                }
            ]
        });
        
        this.showNotification(notification);
    }

    /**
     * Show error message for configuration and connectivity issues
     * @param {string} errorMessage - Error message
     * @param {Object} options - Display options
     */
    showErrorMessage(errorMessage, options = {}) {
        if (!this.config.showErrorMessages) {
            return;
        }

        const notification = this.createNotification({
            type: 'error',
            title: options.title || 'Cache Error',
            message: errorMessage,
            action: options.action || 'Check configuration',
            autoHide: options.autoHide !== false,
            actions: options.actions || []
        });
        
        this.showNotification(notification);
    }

    /**
     * Create notification element
     * @param {Object} config - Notification configuration
     * @returns {HTMLElement} Notification element
     */
    createNotification(config) {
        const notification = document.createElement('div');
        notification.className = `cache-notification cache-notification-${config.type}`;
        notification.style.cssText = this.getNotificationStyles(config.type);
        
        const content = this.getNotificationContent(config);
        notification.innerHTML = content;
        
        // Add action handlers
        if (config.actions && config.actions.length > 0) {
            this.addNotificationActions(notification, config.actions);
        }
        
        return notification;
    }

    /**
     * Get CSS styles for notifications
     * @param {string} type - Notification type
     * @returns {string} CSS styles
     */
    getNotificationStyles(type) {
        const position = this.getPositionStyles();
        const theme = this.getThemeStyles();
        
        const typeColors = {
            info: { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' },
            warning: { bg: '#fff3e0', border: '#ff9800', text: '#ef6c00' },
            error: { bg: '#ffebee', border: '#f44336', text: '#c62828' },
            success: { bg: '#e8f5e8', border: '#4caf50', text: '#2e7d32' }
        };
        
        const colors = typeColors[type] || typeColors.info;
        
        return `
            position: fixed;
            ${position}
            background: ${colors.bg};
            color: ${colors.text};
            border: 1px solid ${colors.border};
            border-left: 4px solid ${colors.border};
            border-radius: 6px;
            padding: 12px 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 10001;
            max-width: 320px;
            animation: cache-notification-slide-in 0.3s ease-out;
        `;
    }

    /**
     * Get notification content HTML
     * @param {Object} config - Notification configuration
     * @returns {string} HTML content
     */
    getNotificationContent(config) {
        let html = `
            <div class="notification-header">
                <strong>${config.title}</strong>
            </div>
            <div class="notification-message">
                ${config.message}
            </div>
        `;
        
        if (config.action) {
            html += `
                <div class="notification-action">
                    ${config.action}
                </div>
            `;
        }
        
        return html;
    }

    /**
     * Add action buttons to notification
     * @param {HTMLElement} notification - Notification element
     * @param {Array} actions - Action configurations
     */
    addNotificationActions(notification, actions) {
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'notification-actions';
        actionsContainer.style.cssText = `
            margin-top: 8px;
            display: flex;
            gap: 8px;
        `;
        
        for (const action of actions) {
            const button = document.createElement('button');
            button.textContent = action.text;
            button.style.cssText = `
                background: rgba(0,0,0,0.1);
                border: 1px solid rgba(0,0,0,0.2);
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
                transition: background 0.2s ease;
            `;
            
            button.addEventListener('click', action.action);
            actionsContainer.appendChild(button);
        }
        
        notification.appendChild(actionsContainer);
    }

    /**
     * Show notification
     * @param {HTMLElement} notification - Notification element
     */
    showNotification(notification) {
        // Hide current notification if exists
        this.hideCurrentNotification();
        
        // Add notification styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes cache-notification-slide-in {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Show new notification
        document.body.appendChild(notification);
        this.currentNotification = notification;
        
        // Auto-hide if configured
        if (notification.classList.contains('cache-notification-info') || 
            notification.classList.contains('cache-notification-warning')) {
            setTimeout(() => {
                this.hideCurrentNotification();
            }, this.config.autoHideDelay);
        }
    }

    /**
     * Hide current notification
     */
    hideCurrentNotification() {
        if (this.currentNotification && this.currentNotification.parentElement) {
            this.currentNotification.remove();
            this.currentNotification = null;
        }
    }

    /**
     * Show detailed status information
     * @param {Object} status - Cache status
     */
    showDetailedStatus(status) {
        const modal = this.createDetailedStatusModal(status);
        document.body.appendChild(modal);
    }

    /**
     * Create detailed status modal
     * @param {Object} status - Cache status
     * @returns {HTMLElement} Modal element
     */
    createDetailedStatusModal(status) {
        const modal = document.createElement('div');
        modal.className = 'cache-status-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10002;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        content.innerHTML = this.getDetailedStatusContent(status);
        
        // Add close handler
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Add close button
        const closeButton = content.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', () => modal.remove());
        }
        
        modal.appendChild(content);
        return modal;
    }

    /**
     * Get detailed status content HTML
     * @param {Object} status - Cache status
     * @returns {string} HTML content
     */
    getDetailedStatusContent(status) {
        const ageInfo = status.ageInfo || {};
        const staleness = status.staleness || {};
        
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0;">Cache Status</h3>
                <button class="close-button" style="background: none; border: none; font-size: 18px; cursor: pointer;">×</button>
            </div>
            
            <div style="margin-bottom: 12px;">
                <strong>Status:</strong> ${status.isReady ? '✅ Ready' : '⏳ Loading'}
            </div>
            
            ${status.error ? `
                <div style="margin-bottom: 12px; color: #d32f2f;">
                    <strong>Error:</strong> ${status.error}
                </div>
            ` : ''}
            
            <div style="margin-bottom: 12px;">
                <strong>Last Updated:</strong> ${ageInfo.humanReadable || 'Never'}
            </div>
            
            <div style="margin-bottom: 12px;">
                <strong>Staleness:</strong> 
                <span style="color: ${staleness.isStale ? '#ff6b35' : '#28a745'};">
                    ${staleness.description || 'Fresh'}
                </span>
            </div>
            
            <div style="margin-bottom: 12px;">
                <strong>Crypto Rates:</strong> ${status.cryptoCount || 0} currencies
            </div>
            
            <div style="margin-bottom: 16px;">
                <strong>Fiat Rates:</strong> ${status.fiatCount || 0} currencies
            </div>
            
            ${status.recommendations && status.recommendations.length > 0 ? `
                <div style="margin-bottom: 16px;">
                    <strong>Recommendations:</strong>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        ${status.recommendations.map(rec => `
                            <li style="margin-bottom: 4px;">${rec.message}</li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
            
            <div style="text-align: right;">
                <button onclick="this.closest('.cache-status-modal').remove()" style="
                    background: #007cba;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Close</button>
            </div>
        `;
    }

    /**
     * Get position styles based on configuration
     * @returns {string} CSS position styles
     */
    getPositionStyles() {
        const positions = {
            'top-right': 'top: 16px; right: 16px;',
            'top-left': 'top: 16px; left: 16px;',
            'bottom-right': 'bottom: 16px; right: 16px;',
            'bottom-left': 'bottom: 16px; left: 16px;'
        };
        
        return positions[this.config.position] || positions['top-right'];
    }

    /**
     * Get theme styles based on configuration
     * @returns {Object} Theme color object
     */
    getThemeStyles() {
        const themes = {
            light: {
                background: '#ffffff',
                text: '#333333',
                border: '#e0e0e0',
                shadow: 'rgba(0,0,0,0.1)'
            },
            dark: {
                background: '#2d2d2d',
                text: '#ffffff',
                border: '#404040',
                shadow: 'rgba(0,0,0,0.3)'
            }
        };
        
        let theme = this.config.theme;
        if (theme === 'auto') {
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        
        return themes[theme] || themes.light;
    }

    /**
     * Start periodic status updates
     */
    startPeriodicUpdates() {
        setInterval(() => {
            this.updateStatusDisplay();
        }, 30000); // Update every 30 seconds
    }

    /**
     * Trigger manual cache refresh
     */
    async triggerManualRefresh() {
        try {
            this.log('Triggering manual cache refresh');
            
            // Show loading indicator
            this.showLoadingIndicator();
            
            // Get extension initializer and trigger refresh
            const extensionInitializer = window.extensionInitializer;
            if (extensionInitializer) {
                await extensionInitializer.retryInitialization();
            }
            
            // Hide current notification
            this.hideCurrentNotification();
            
            // Show success message
            this.showNotification(this.createNotification({
                type: 'success',
                title: 'Cache Refreshed',
                message: 'Exchange rates have been updated',
                autoHide: true
            }));
            
        } catch (error) {
            this.log('Manual refresh failed:', error);
            
            this.showErrorMessage('Failed to refresh cache: ' + error.message, {
                title: 'Refresh Failed',
                autoHide: true
            });
        } finally {
            this.hideLoadingIndicator();
        }
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        this.log('Configuration updated:', this.config);
    }

    /**
     * Destroy the status display and clean up
     */
    destroy() {
        this.hideLoadingIndicator();
        this.hideCurrentNotification();
        
        if (this.statusBadge && this.statusBadge.parentElement) {
            this.statusBadge.remove();
        }
        
        this.log('Cache status display destroyed');
    }

    /**
     * Log message if logging is enabled
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    log(message, ...args) {
        if (this.config.enableLogging) {
            console.log(`[CacheStatusDisplay] ${message}`, ...args);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheStatusDisplay;
}
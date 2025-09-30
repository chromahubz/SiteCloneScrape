// App Sumo Website Scraper & Builder - Frontend JavaScript

// Global state
let scrapedData = null;
let businessInfo = {};
let generatedWebsite = null;
let hostedSite = null;

// Input validation utilities
const validators = {
    url: (url) => {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    },

    email: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    required: (value) => {
        return value && value.trim().length > 0;
    },

    projectName: (name) => {
        return name && name.trim().length >= 3 && name.trim().length <= 50;
    },

    businessName: (name) => {
        return name && name.trim().length >= 2 && name.trim().length <= 100;
    },

    price: (price) => {
        if (!price) return true; // Optional field
        const priceRegex = /^\$?\d+(\.\d{2})?$/;
        return priceRegex.test(price.trim());
    }
};

// Error handling utilities
function handleApiError(error, context = '') {
    console.error(`API Error ${context}:`, error);

    let message = 'An unexpected error occurred. Please try again.';

    if (error.message) {
        if (error.message.includes('Failed to fetch')) {
            message = 'Unable to connect to server. Please check your internet connection.';
        } else if (error.message.includes('timeout')) {
            message = 'Request timed out. The server may be busy, please try again.';
        } else if (error.message.includes('rate limit')) {
            message = 'Too many requests. Please wait a moment before trying again.';
        } else {
            message = error.message;
        }
    }

    showNotification(message, 'error');
    return message;
}

function validateField(fieldId, validator, errorMessage) {
    const field = document.getElementById(fieldId);
    const value = field.value.trim();

    if (!validator(value)) {
        field.classList.add('border-red-500', 'bg-red-50');
        field.classList.remove('border-gray-200', 'border-primary');
        showFieldError(fieldId, errorMessage);
        return false;
    } else {
        field.classList.remove('border-red-500', 'bg-red-50');
        field.classList.add('border-gray-200');
        clearFieldError(fieldId);
        return true;
    }
}

function showFieldError(fieldId, message) {
    clearFieldError(fieldId); // Remove existing error

    const field = document.getElementById(fieldId);
    const errorDiv = document.createElement('div');
    errorDiv.id = `${fieldId}-error`;
    errorDiv.className = 'text-red-500 text-sm mt-1 flex items-center';
    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i>${message}`;

    field.parentNode.appendChild(errorDiv);
}

function clearFieldError(fieldId) {
    const existingError = document.getElementById(`${fieldId}-error`);
    if (existingError) {
        existingError.remove();
    }
}

// Notification system
function showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    const colors = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800'
    };

    notification.className = `${colors[type]} border-l-4 p-4 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 ease-in-out`;
    notification.innerHTML = `
        <div class="flex items-start">
            <i class="${icons[type]} mr-3 mt-0.5"></i>
            <div class="flex-1">
                <p class="font-medium">${message}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    container.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);

    // Auto remove
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

// Tab management
document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => {
                t.classList.remove('bg-primary', 'text-white');
                t.classList.add('bg-gray-100', 'text-gray-700');
            });
            contents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.remove('bg-gray-100', 'text-gray-700');
            tab.classList.add('bg-primary', 'text-white');

            // Show corresponding content
            const contentId = tab.id.replace('tab-', 'content-');
            document.getElementById(contentId).classList.add('active');
        });
    });

    // Initialize first tab as active
    if (tabs.length > 0) {
        tabs[0].classList.remove('bg-gray-100', 'text-gray-700');
        tabs[0].classList.add('bg-primary', 'text-white');
    }

    // Event listeners
    document.getElementById('scrape-btn').addEventListener('click', scrapeWebsite);
    document.getElementById('analyze-btn').addEventListener('click', analyzeBusinessInfo);
    document.getElementById('recreate-btn').addEventListener('click', recreateWebsite);
    document.getElementById('generate-outreach-btn').addEventListener('click', generateOutreach);

    // Business Intelligence - Scraped Content Toggle
    const businessToggleBtn = document.getElementById('business-scraped-content-toggle');
    const businessCopyBtn = document.getElementById('business-copy-content');

    if (businessToggleBtn) {
        businessToggleBtn.addEventListener('click', () => {
            const section = document.getElementById('business-scraped-content-section');
            const chevron = document.getElementById('business-content-chevron');
            if (section && chevron) {
                if (section.classList.contains('hidden')) {
                    section.classList.remove('hidden');
                    chevron.classList.add('rotate-180');
                } else {
                    section.classList.add('hidden');
                    chevron.classList.remove('rotate-180');
                }
            }
        });
    }

    if (businessCopyBtn) {
        businessCopyBtn.addEventListener('click', async () => {
            const content = document.getElementById('business-scraped-content-display');
            if (content && content.textContent) {
                try {
                    await navigator.clipboard.writeText(content.textContent);
                    showNotification('Complete scraped data copied to clipboard!', 'success', 2000);
                } catch (err) {
                    showNotification('Failed to copy content', 'error');
                }
            }
        });
    }
    document.getElementById('copy-email-btn').addEventListener('click', () => copyToClipboard('email-content'));
    document.getElementById('copy-proposal-btn').addEventListener('click', () => copyToClipboard('proposal-content'));
    document.getElementById('download-website-btn').addEventListener('click', downloadWebsite);
    document.getElementById('download-package-btn').addEventListener('click', downloadPackage);
    document.getElementById('view-live-btn').addEventListener('click', viewLiveSite);
    document.getElementById('save-project-btn').addEventListener('click', saveProject);
    document.getElementById('refresh-projects-btn').addEventListener('click', loadProjects);
    document.getElementById('refresh-preview-btn').addEventListener('click', refreshWebsitePreview);
    document.getElementById('raw-data-toggle').addEventListener('click', toggleRawData);
    document.getElementById('copy-raw-data-btn').addEventListener('click', copyRawData);

    // Add URL input listener for live preview
    document.getElementById('website-url').addEventListener('input', handleUrlInput);
    document.getElementById('website-url').addEventListener('blur', showWebsitePreview);

    // Load projects on page load
    loadProjects();
});

// API Base URL
const API_BASE = 'http://localhost:3003';

// Button state management
function setButtonLoading(buttonId, isLoading, loadingText = 'Processing...') {
    const button = document.getElementById(buttonId);
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `<div class="loading inline-block mr-2"></div>${loadingText}`;
        button.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.innerHTML;
        button.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

// Step 1: Scrape Website
async function scrapeWebsite() {
    const url = document.getElementById('website-url').value.trim();

    // Clear any existing errors
    clearFieldError('website-url');

    // Validate URL
    if (!validateField('website-url', validators.required, 'Please enter a website URL')) {
        return;
    }

    if (!validateField('website-url', validators.url, 'Please enter a valid URL (e.g., https://example.com)')) {
        return;
    }

    const resultsEl = document.getElementById('scrape-results');
    const contentEl = document.getElementById('scraped-content');

    setButtonLoading('scrape-btn', true, 'Discovering Complete Sitemap...');
    resultsEl.classList.add('hidden');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout for comprehensive scraping

        const response = await fetch(`${API_BASE}/api/scrape`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Validate response data
        if (!data.title && !data.content && !data.description) {
            throw new Error('Unable to extract meaningful data from this website. Please check the URL and try again.');
        }

        scrapedData = data;

        // Populate the Business Intelligence scraped data section
        const businessContentDisplay = document.getElementById('business-scraped-content-display');
        const businessContentLength = document.getElementById('business-content-length');
        if (businessContentDisplay && data.content) {
            businessContentDisplay.textContent = data.content;
            if (businessContentLength) {
                businessContentLength.textContent = data.content.length.toLocaleString();
            }
        }

        // Update current website preview with error handling
        try {
            const currentIframe = document.getElementById('current-iframe');

            if (currentIframe) {
                currentIframe.src = url;
                currentIframe.onload = () => console.log('✅ Website preview loaded successfully');
                currentIframe.onerror = () => {
                    console.warn('⚠️ Website preview failed to load - site may block iframes');
                    currentIframe.src = 'data:text/html,<div style="padding:20px;text-align:center;color:#666;font-family:Arial;">⚠️ This website cannot be previewed due to security restrictions.<br><br>Click <a href="' + url + '" target="_blank" style="color:#059669;">here</a> to view the site directly.</div>';
                };
                console.log('🔗 Setting website preview iframe to:', url);
            } else {
                console.error('❌ current-iframe element not found');
            }
        } catch (iframeError) {
            console.warn('Unable to load iframe preview:', iframeError);
        }

        // Auto-fill business info if available
        if (data.title) document.getElementById('business-name').value = data.title;
        if (data.description) document.getElementById('business-services').value = data.description;

        // Display scraped content with safe HTML escaping
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        // Build sitemap info if available
        const sitemapInfo = data.metadata?.sitemapComplete
            ? `<h4 class="font-bold mb-2 mt-4 text-green-600"><i class="fas fa-sitemap mr-2"></i>Complete Sitemap Discovered:</h4>
               <div class="text-sm bg-green-50 p-3 rounded">
                   <div class="grid grid-cols-2 gap-2 mb-2">
                       <div><strong>Total Pages:</strong> ${data.metadata.totalPagesDiscovered}</div>
                       <div><strong>Pages Scraped:</strong> ${data.metadata.pagesScraped}</div>
                       <div><strong>Priority Pages:</strong> ${data.metadata.priorityPagesFound}</div>
                       <div><strong>Word Count:</strong> ${data.metadata.wordCount.toLocaleString()}</div>
                   </div>
               </div>`
            : '';

        // Create collapsible full content section
        const fullContentPreview = data.content ? `
            <div class="mt-4">
                <button id="toggle-full-content" class="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg text-left font-bold flex items-center justify-between transition-colors">
                    <span><i class="fas fa-file-alt text-gray-600 mr-2"></i>View Complete Scraped Content (${data.content.length.toLocaleString()} characters)</span>
                    <i id="content-chevron" class="fas fa-chevron-down text-gray-600"></i>
                </button>
                <div id="full-content-section" class="hidden mt-2 bg-white border-2 border-gray-200 rounded-lg p-4">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm font-bold text-gray-700">Complete Website Content:</span>
                        <button id="copy-full-content" class="text-xs bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded transition-colors">
                            <i class="fas fa-copy mr-1"></i>Copy All
                        </button>
                    </div>
                    <div class="bg-gray-50 p-4 rounded max-h-96 overflow-y-auto text-sm whitespace-pre-wrap font-mono">
                        ${escapeHtml(data.content)}
                    </div>
                </div>
            </div>
        ` : '';

        contentEl.innerHTML = `
            <h4 class="font-bold mb-2">Title: ${escapeHtml(data.title || 'N/A')}</h4>
            <h4 class="font-bold mb-2">Description: ${escapeHtml(data.description || 'N/A')}</h4>
            ${sitemapInfo}
            <h4 class="font-bold mb-2 mt-4">Content Preview (first 1000 chars):</h4>
            <div class="bg-black/20 p-4 rounded text-sm overflow-auto max-h-40">
                ${data.content ? escapeHtml(data.content.substring(0, 1000)) + '...' : 'No content extracted'}
            </div>
            ${fullContentPreview}
            <h4 class="font-bold mb-2 mt-4">Extracted Links:</h4>
            <div class="text-sm">
                ${data.links ? data.links.slice(0, 10).map(link => `<div class="truncate">${escapeHtml(link)}</div>`).join('') : 'No links found'}
            </div>
        `;

        // Add event listener for toggle
        const toggleBtn = document.getElementById('toggle-full-content');
        const copyBtn = document.getElementById('copy-full-content');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const section = document.getElementById('full-content-section');
                const chevron = document.getElementById('content-chevron');
                if (section.classList.contains('hidden')) {
                    section.classList.remove('hidden');
                    chevron.classList.add('rotate-180');
                } else {
                    section.classList.add('hidden');
                    chevron.classList.remove('rotate-180');
                }
            });
        }
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(data.content);
                    showNotification('Complete content copied to clipboard!', 'success', 2000);
                } catch (err) {
                    showNotification('Failed to copy content', 'error');
                }
            });
        }

        resultsEl.classList.remove('hidden');

        // Enable next tab
        document.getElementById('tab-analyze').classList.remove('text-white/50');

        showNotification('Website scraped successfully! Proceed to analyze business information.', 'success');

        // Auto-advance to next tab after 2 seconds
        setTimeout(() => {
            document.getElementById('tab-analyze').click();
            showNotification('🚀 Ready for business analysis!', 'info', 3000);
        }, 2000);

    } catch (error) {
        if (error.name === 'AbortError') {
            handleApiError(new Error('Scraping timed out after 3 minutes. The website may have too many pages or be very slow. Try again or use a simpler website.'), 'scrape');
        } else {
            handleApiError(error, 'scrape');
        }

        // Hide results on error
        resultsEl.classList.add('hidden');
    } finally {
        setButtonLoading('scrape-btn', false);
    }
}

// Step 2: Analyze Business Info
async function analyzeBusinessInfo() {
    // Clear all field errors
    ['business-name', 'business-email'].forEach(clearFieldError);

    // Validate required fields
    if (!validateField('business-name', validators.businessName, 'Business name must be 2-100 characters long')) {
        return;
    }

    // Validate email if provided
    const emailField = document.getElementById('business-email');
    if (emailField.value.trim() && !validateField('business-email', validators.email, 'Please enter a valid email address')) {
        return;
    }

    setButtonLoading('analyze-btn', true, 'AI Analyzing Entire Website...');

    // Collect business information
    businessInfo = {
        name: document.getElementById('business-name').value.trim(),
        industry: document.getElementById('business-industry').value.trim(),
        owner: document.getElementById('business-owner').value.trim(),
        email: document.getElementById('business-email').value.trim(),
        issues: document.getElementById('website-issues').value.trim(),
        services: document.getElementById('business-services').value.trim(),
        scrapedData: scrapedData
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for comprehensive AI analysis

        const response = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(businessInfo),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Auto-fill all business information from comprehensive AI analysis
        console.log('🔍 DEBUG: Full analyze response:', data);
        console.log('🔍 DEBUG: data.extractedInfo exists?', !!data.extractedInfo);

        if (data.extractedInfo) {
            const aiData = data.extractedInfo;
            console.log('🧠 Frontend received AI data:', aiData);
            console.log('🔍 DEBUG: AI data keys:', Object.keys(aiData));
            console.log('🔍 DEBUG: AI data JSON:', JSON.stringify(aiData, null, 2));

            // Helper function to safely get field value with multiple possible names
            const getFieldValue = (obj, possibleNames) => {
                for (const name of possibleNames) {
                    if (obj[name] && typeof obj[name] === 'string' && obj[name] !== 'Unknown' && obj[name].trim()) {
                        return obj[name].trim();
                    }
                }
                return null;
            };

            // Fill ALL business info from AI - always override with AI-extracted data
            const businessName = getFieldValue(aiData, ['businessName', 'name', 'companyName']);
            if (businessName) {
                document.getElementById('business-name').value = businessName;
                businessInfo.name = businessName;
                console.log('✅ AUTO-FILLED: Business Name =', businessName);
            }

            const industry = getFieldValue(aiData, ['industry', 'sector', 'businessType']);
            if (industry) {
                document.getElementById('business-industry').value = industry;
                businessInfo.industry = industry;
                console.log('✅ AUTO-FILLED: Industry =', industry);
            }

            const owner = getFieldValue(aiData, ['owner', 'founder', 'contact', 'contactPerson']);
            if (owner) {
                document.getElementById('business-owner').value = owner;
                businessInfo.owner = owner;
                console.log('✅ AUTO-FILLED: Owner =', owner);
            }

            const email = getFieldValue(aiData, ['email', 'contactEmail']);
            if (email && validators.email(email)) {
                document.getElementById('business-email').value = email;
                businessInfo.email = email;
                console.log('✅ AUTO-FILLED: Email =', email);
            }

            const phone = getFieldValue(aiData, ['phone', 'phoneNumber', 'contactPhone']);
            if (phone) {
                // Store phone for later use (no field in form currently)
                businessInfo.phone = phone;
                console.log('✅ EXTRACTED: Phone =', phone);
            }

            const services = getFieldValue(aiData, ['services', 'offerings', 'products']);
            if (services) {
                document.getElementById('business-services').value = services;
                businessInfo.services = services;
                console.log('✅ AUTO-FILLED: Services =', services);
            }

            const issues = getFieldValue(aiData, ['issues', 'problems', 'improvements']);
            if (issues) {
                document.getElementById('website-issues').value = issues;
                businessInfo.issues = issues;
                console.log('✅ AUTO-FILLED: Issues =', issues);
            }

            const location = getFieldValue(aiData, ['location', 'address', 'headquarters']);
            if (location) {
                businessInfo.location = location;
                console.log('✅ EXTRACTED: Location =', location);
            }

            const description = getFieldValue(aiData, ['description', 'about', 'companyDescription']);
            if (description) {
                businessInfo.description = description;
                console.log('✅ EXTRACTED: Description =', description.substring(0, 100) + '...');
            }

            // Show detailed insights in the notification
            if (aiData.keyInsights) {
                const insights = aiData.keyInsights;
                let insightText = '🧠 AI Analysis Complete!\n\n';

                if (insights.valuePropositions && insights.valuePropositions.length > 0) {
                    insightText += `💡 Key Value Props: ${insights.valuePropositions.slice(0, 2).join(', ')}\n`;
                }

                if (insights.targetAudience) {
                    insightText += `🎯 Target Audience: ${insights.targetAudience.substring(0, 100)}...\n`;
                }

                if (insights.contactInfo && insights.contactInfo.phone) {
                    insightText += `📞 Found Phone: ${insights.contactInfo.phone}\n`;
                }

                if (insights.websiteAnalysis && insights.websiteAnalysis.missingElements && insights.websiteAnalysis.missingElements.length > 0) {
                    insightText += `⚠️ Missing: ${insights.websiteAnalysis.missingElements.slice(0, 2).join(', ')}\n`;
                }

                console.log('🧠 Full AI Business Intelligence Analysis:', aiData);
                showNotification(insightText, 'success', 8000);
            } else {
                showNotification('✅ Business intelligence extracted and auto-filled!', 'success');
            }
        } else {
            console.log('❌ NO AI DATA: data.extractedInfo is missing or falsy');
            console.log('🔍 Available data keys:', Object.keys(data));
            showNotification('⚠️ AI analysis completed but no structured data returned', 'warning');
        }

        // Show and populate raw data section if we have scraped data
        if (scrapedData && scrapedData.content) {
            document.getElementById('raw-data-section').classList.remove('hidden');
            document.getElementById('raw-data-display').textContent = scrapedData.content;
        }

        // Enable next tab
        document.getElementById('tab-recreate').classList.remove('text-white/50');

        // Auto-advance to next tab after 2 seconds
        setTimeout(() => {
            document.getElementById('tab-recreate').click();
            showNotification('🎨 Ready to recreate your website!', 'info', 3000);
        }, 2000);

    } catch (error) {
        if (error.name === 'AbortError') {
            handleApiError(new Error('AI analysis timed out after 60 seconds. The website may be very large. Please try again or use a smaller website.'), 'analyze');
        } else {
            handleApiError(error, 'analyze');
        }
    } finally {
        setButtonLoading('analyze-btn', false);
    }
}

// Step 3: Recreate Website
async function recreateWebsite() {
    const instructions = document.getElementById('design-instructions').value;
    const loadingEl = document.getElementById('recreate-loading');

    if (!scrapedData) {
        showNotification('Please scrape a website first', 'warning');
        return;
    }

    setButtonLoading('recreate-btn', true, 'Creating Website...');
    loadingEl.classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE}/api/recreate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                scrapedData,
                businessInfo,
                instructions: instructions || 'Create a modern, professional website'
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        generatedWebsite = data;
        hostedSite = data.hostedSite || null;

        // Display the new website
        const previewEl = document.getElementById('new-preview');
        previewEl.innerHTML = `
            <iframe class="w-full h-full rounded" srcdoc="${data.html.replace(/"/g, '&quot;')}"></iframe>
        `;

        // Show export buttons
        document.getElementById('website-export-buttons').classList.remove('hidden');

        // Show/hide live site button based on hosting status
        updateLiveSiteButton();

        // Enable next tab
        document.getElementById('tab-outreach').classList.remove('text-white/50');

        showNotification('Website recreation complete! You can now export your website or generate outreach materials.', 'success');

        // Auto-advance to next tab after 3 seconds (longer to let user see the result)
        setTimeout(() => {
            document.getElementById('tab-outreach').click();
            showNotification('📧 Ready to generate outreach materials!', 'info', 3000);
        }, 3000);

    } catch (error) {
        showNotification('Error recreating website: ' + error.message, 'error');
    } finally {
        setButtonLoading('recreate-btn', false);
        loadingEl.classList.add('hidden');
    }
}

// Step 4: Generate Outreach
async function generateOutreach() {
    // Clear all field errors
    ['your-name', 'your-email', 'package-price'].forEach(clearFieldError);

    // Validate required fields
    if (!validateField('your-name', validators.required, 'Please enter your name')) {
        return;
    }

    if (!validateField('your-email', validators.email, 'Please enter a valid email address')) {
        return;
    }

    // Validate price if provided
    const packagePriceField = document.getElementById('package-price');
    if (packagePriceField.value.trim() && !validateField('package-price', validators.price, 'Please enter a valid price (e.g., $2997 or 2997.00)')) {
        return;
    }

    if (!businessInfo.name) {
        showNotification('Please complete the business analysis first', 'warning');
        return;
    }

    const yourName = document.getElementById('your-name').value.trim();
    const yourEmail = document.getElementById('your-email').value.trim();
    const packagePrice = document.getElementById('package-price').value.trim();

    setButtonLoading('generate-outreach-btn', true, 'Generating Outreach...');

    try {
        const response = await fetch(`${API_BASE}/api/outreach`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                businessInfo,
                generatedWebsite,
                yourName,
                yourEmail,
                packagePrice
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Display results
        document.getElementById('email-content').textContent = data.email;
        document.getElementById('proposal-content').textContent = data.proposal;
        document.getElementById('outreach-results').classList.remove('hidden');

    } catch (error) {
        showNotification('Error generating outreach: ' + error.message, 'error');
    } finally {
        setButtonLoading('generate-outreach-btn', false);
    }
}

// Utility: Copy to clipboard
async function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).textContent;
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Copied to clipboard!', 'success', 3000);
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Copied to clipboard!', 'success', 3000);
    }
}

// Export: Download Website HTML
function downloadWebsite() {
    if (!generatedWebsite || !generatedWebsite.html) {
        showNotification('No website to download. Please generate a website first.', 'warning');
        return;
    }

    const businessName = businessInfo.name || 'Website';
    const fileName = `${businessName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_website.html`;

    const blob = new Blob([generatedWebsite.html], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showNotification('Website HTML downloaded successfully!', 'success');
}

// Export: Download Complete Package
async function downloadPackage() {
    if (!generatedWebsite || !businessInfo.name) {
        showNotification('Please complete website generation first.', 'warning');
        return;
    }

    setButtonLoading('download-package-btn', true, 'Creating Package...');

    try {
        const response = await fetch(`${API_BASE}/api/export-package`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                generatedWebsite,
                businessInfo,
                scrapedData
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create package');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const businessName = businessInfo.name || 'Website';
        const fileName = `${businessName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_complete_package.zip`;

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showNotification('Complete package downloaded successfully!', 'success');

    } catch (error) {
        showNotification('Error creating package: ' + error.message, 'error');
    } finally {
        setButtonLoading('download-package-btn', false);
    }
}

// Project Management Functions
async function saveProject() {
    // Clear field errors
    clearFieldError('project-name');

    // Validate project name
    if (!validateField('project-name', validators.projectName, 'Project name must be 3-50 characters long')) {
        return;
    }

    if (!scrapedData && !businessInfo.name) {
        showNotification('No project data to save. Please scrape a website first.', 'warning');
        return;
    }

    const projectName = document.getElementById('project-name').value.trim();

    setButtonLoading('save-project-btn', true, 'Saving...');

    try {
        const projectData = {
            name: projectName,
            scrapedData: scrapedData,
            businessInfo: businessInfo,
            generatedWebsite: generatedWebsite,
            hostedSite: hostedSite,
            createdAt: new Date().toISOString(),
            url: scrapedData?.url || 'Unknown'
        };

        const response = await fetch(`${API_BASE}/api/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(projectData)
        });

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error);
        }

        document.getElementById('project-name').value = '';
        showNotification('Project saved successfully!', 'success');
        loadProjects(); // Refresh the projects list

    } catch (error) {
        showNotification('Error saving project: ' + error.message, 'error');
    } finally {
        setButtonLoading('save-project-btn', false);
    }
}

async function loadProjects() {
    const loadingEl = document.getElementById('projects-loading');
    const listEl = document.getElementById('projects-list');

    loadingEl.classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE}/api/projects`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Update stats
        document.getElementById('total-projects').textContent = data.projects.length;
        document.getElementById('websites-scraped').textContent = data.projects.length;
        document.getElementById('outreach-generated').textContent =
            data.projects.filter(p => p.generatedWebsite).length;

        // Display projects
        displayProjects(data.projects);

    } catch (error) {
        showNotification('Error loading projects: ' + error.message, 'error');
        listEl.innerHTML = `
            <div class="text-center text-red-500 py-8">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p class="text-lg">Error loading projects</p>
                <p class="text-sm">${error.message}</p>
            </div>
        `;
    } finally {
        loadingEl.classList.add('hidden');
    }
}

function displayProjects(projects) {
    const listEl = document.getElementById('projects-list');

    if (projects.length === 0) {
        listEl.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-folder-open text-4xl mb-4"></i>
                <p class="text-lg">No saved projects yet</p>
                <p class="text-sm">Create your first project by scraping a website and saving it above</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = projects.map(project => `
        <div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="text-lg font-bold text-gray-800 mb-1">${project.name}</h4>
                    <p class="text-sm text-gray-600 mb-2">
                        <i class="fas fa-globe mr-1"></i>${project.url}
                    </p>
                    <div class="flex gap-4 text-xs text-gray-500">
                        <span><i class="fas fa-calendar mr-1"></i>${new Date(project.createdAt).toLocaleDateString()}</span>
                        ${project.businessInfo?.name ? `<span><i class="fas fa-building mr-1"></i>${project.businessInfo.name}</span>` : ''}
                        ${project.generatedWebsite ? '<span><i class="fas fa-check-circle mr-1 text-green-500"></i>Website Generated</span>' : ''}
                    </div>
                </div>
                <div class="flex gap-2 ml-4">
                    <button onclick="loadProject('${project.id}')" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded transition-colors">
                        <i class="fas fa-upload mr-1"></i>Load
                    </button>
                    <button onclick="deleteProject('${project.id}')" class="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-3 rounded transition-colors">
                        <i class="fas fa-trash mr-1"></i>Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadProject(projectId) {
    try {
        const response = await fetch(`${API_BASE}/api/projects/${projectId}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        const project = data.project;

        // Load project data into global state
        scrapedData = project.scrapedData;
        businessInfo = project.businessInfo || {};
        generatedWebsite = project.generatedWebsite;
        hostedSite = project.hostedSite || null;

        // Fill form fields
        if (scrapedData) {
            document.getElementById('website-url').value = scrapedData.url || '';
            if (scrapedData.title) document.getElementById('business-name').value = scrapedData.title;
            if (scrapedData.description) document.getElementById('business-services').value = scrapedData.description;
        }

        if (businessInfo) {
            if (businessInfo.name) document.getElementById('business-name').value = businessInfo.name;
            if (businessInfo.industry) document.getElementById('business-industry').value = businessInfo.industry;
            if (businessInfo.owner) document.getElementById('business-owner').value = businessInfo.owner;
            if (businessInfo.email) document.getElementById('business-email').value = businessInfo.email;
            if (businessInfo.services) document.getElementById('business-services').value = businessInfo.services;
            if (businessInfo.issues) document.getElementById('website-issues').value = businessInfo.issues;
        }

        // Update UI to show loaded data
        if (scrapedData) {
            document.getElementById('current-iframe').src = scrapedData.url || '';
            document.getElementById('scrape-results').classList.remove('hidden');
            document.getElementById('scraped-content').innerHTML = `
                <h4 class="font-bold mb-2">Title: ${scrapedData.title || 'N/A'}</h4>
                <h4 class="font-bold mb-2">Description: ${scrapedData.description || 'N/A'}</h4>
                <h4 class="font-bold mb-2">Content Preview:</h4>
                <div class="bg-black/20 p-4 rounded text-sm overflow-auto max-h-40">
                    ${scrapedData.content ? scrapedData.content.substring(0, 1000) + '...' : 'No content extracted'}
                </div>
            `;
        }

        if (generatedWebsite) {
            document.getElementById('new-preview').innerHTML = `
                <iframe class="w-full h-full rounded" srcdoc="${generatedWebsite.html.replace(/"/g, '&quot;')}"></iframe>
            `;
            document.getElementById('website-export-buttons').classList.remove('hidden');
            updateLiveSiteButton();
        }

        // Switch to scrape tab to show loaded data
        document.getElementById('tab-scrape').click();

        showNotification(`Project "${project.name}" loaded successfully!`, 'success');

    } catch (error) {
        showNotification('Error loading project: ' + error.message, 'error');
    }
}

async function deleteProject(projectId) {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error);
        }

        showNotification('Project deleted successfully!', 'success');
        loadProjects(); // Refresh the projects list

    } catch (error) {
        showNotification('Error deleting project: ' + error.message, 'error');
    }
}

// Live Site Hosting Functions
function updateLiveSiteButton() {
    const liveSiteBtn = document.getElementById('view-live-btn');

    if (hostedSite && hostedSite.url) {
        liveSiteBtn.classList.remove('hidden');
        showNotification('✨ Website is now live! Click "View Live Site" to see it.', 'success', 6000);
    } else {
        liveSiteBtn.classList.add('hidden');
    }
}

function viewLiveSite() {
    if (hostedSite && hostedSite.url) {
        window.open(hostedSite.url, '_blank');
        showNotification('Opening live website in new tab...', 'info', 3000);
    } else {
        showNotification('No live site available. Please generate a website first.', 'warning');
    }
}

// Website Preview Functions
let urlInputTimeout;

function handleUrlInput() {
    const url = document.getElementById('website-url').value.trim();

    // Clear previous timeout
    clearTimeout(urlInputTimeout);

    // Hide preview if URL is empty
    if (!url) {
        document.getElementById('website-preview-section').classList.add('hidden');
        return;
    }

    // Debounce URL input - show preview after user stops typing for 1 second
    urlInputTimeout = setTimeout(() => {
        if (validators.url(url)) {
            showWebsitePreview();
        }
    }, 1000);
}

function showWebsitePreview() {
    const url = document.getElementById('website-url').value.trim();

    if (!url || !validators.url(url)) {
        document.getElementById('website-preview-section').classList.add('hidden');
        return;
    }

    try {
        // Show the preview section
        document.getElementById('website-preview-section').classList.remove('hidden');

        // Load the website in the iframe
        const iframe = document.getElementById('scrape-preview-iframe');
        iframe.src = url;

        // Also update the iframe in the recreation tab for consistency
        document.getElementById('current-iframe').src = url;

    } catch (error) {
        console.warn('Unable to load website preview:', error);
        showNotification('Unable to load website preview. Some sites restrict embedding.', 'warning', 4000);
    }
}

function refreshWebsitePreview() {
    const url = document.getElementById('website-url').value.trim();

    if (!url || !validators.url(url)) {
        showNotification('Please enter a valid URL first.', 'warning');
        return;
    }

    try {
        const iframe = document.getElementById('scrape-preview-iframe');

        // Force reload by updating src with timestamp
        iframe.src = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();

        showNotification('Website preview refreshed!', 'info', 2000);
    } catch (error) {
        console.warn('Unable to refresh preview:', error);
        showNotification('Unable to refresh preview.', 'warning');
    }
}

// Raw Data Functions
function toggleRawData() {
    const content = document.getElementById('raw-data-content');
    const chevron = document.getElementById('raw-data-chevron');

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        content.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
}

function copyRawData() {
    const rawDataDisplay = document.getElementById('raw-data-display');
    const text = rawDataDisplay.textContent;

    if (!text) {
        showNotification('No raw data to copy', 'warning');
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        showNotification('Raw website data copied to clipboard!', 'success', 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showNotification('Failed to copy raw data', 'error');
    });
}
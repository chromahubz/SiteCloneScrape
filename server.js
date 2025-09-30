const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

// Backend validation utilities
const validateInput = {
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
        return value && typeof value === 'string' && value.trim().length > 0;
    },

    projectName: (name) => {
        return name && typeof name === 'string' && name.trim().length >= 3 && name.trim().length <= 50;
    },

    businessName: (name) => {
        return name && typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 100;
    },

    sanitizeString: (str) => {
        if (typeof str !== 'string') return '';
        return str.trim().replace(/[<>]/g, ''); // Basic XSS prevention
    }
};

// Error handling middleware
const handleError = (res, error, context = '') => {
    console.error(`Server Error ${context}:`, error);

    if (error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({
            error: 'Unable to connect to external service. Please try again later.'
        });
    }

    if (error.message && error.message.includes('rate limit')) {
        return res.status(429).json({
            error: 'Rate limit exceeded. Please wait before making another request.'
        });
    }

    // Generic error response
    res.status(500).json({
        error: 'An internal server error occurred. Please try again later.'
    });
};

// Import Firecrawl for professional website scraping
const FirecrawlApp = require('@mendable/firecrawl-js').default;

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large scraped content
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('.'));

// Store scraped data and projects
const scrapedWebsites = new Map();
const generatedProjects = new Map();

// Initialize Firecrawl client
const firecrawl = process.env.FIRECRAWL_API_KEY && process.env.FIRECRAWL_API_KEY !== 'fc-your_firecrawl_key_here'
    ? new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY })
    : null;

// Scrape website endpoint
app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;

        // Input validation
        if (!validateInput.required(url)) {
            throw new Error('URL is required');
        }

        if (!validateInput.url(url)) {
            throw new Error('Please provide a valid URL (e.g., https://example.com)');
        }

        // Sanitize URL
        const sanitizedUrl = validateInput.sanitizeString(url);

        console.log('🕷️ Scraping website:', sanitizedUrl);

        // Use Firecrawl if available, otherwise fall back to enhanced scraping
        const scrapedData = firecrawl
            ? await professionalScrapeWebsite(sanitizedUrl)
            : await enhancedScrapeWebsite(sanitizedUrl);

        // Validate scraped data
        if (!scrapedData.title && !scrapedData.content && !scrapedData.description) {
            throw new Error('Unable to extract meaningful data from this website. The site may be blocking scraping or may not contain readable content.');
        }

        // Store scraped data
        const scrapeId = Math.random().toString(36).substring(2, 15);
        scrapedWebsites.set(scrapeId, {
            ...scrapedData,
            url: sanitizedUrl,
            timestamp: new Date(),
            userAgent: req.headers['user-agent'] || 'Unknown'
        });

        res.json({
            ...scrapedData,
            scrapeId
        });

    } catch (error) {
        handleError(res, error, 'scrape');
    }
});

// Analyze business info endpoint
app.post('/api/analyze', async (req, res) => {
    try {
        const businessInfo = req.body;

        // Input validation
        if (!businessInfo) {
            return res.status(400).json({
                error: 'Business information is required',
                field: 'businessInfo'
            });
        }

        if (typeof businessInfo !== 'object') {
            return res.status(400).json({
                error: 'Invalid business information format',
                field: 'businessInfo'
            });
        }

        // Validate required fields
        if (!businessInfo.name || businessInfo.name.trim().length === 0) {
            return res.status(400).json({
                error: 'Business name is required',
                field: 'name'
            });
        }

        // Sanitize inputs
        const sanitizedBusinessInfo = {
            ...businessInfo,
            name: validateInput.sanitizeString(businessInfo.name),
            description: businessInfo.description ? validateInput.sanitizeString(businessInfo.description) : '',
            industry: businessInfo.industry ? validateInput.sanitizeString(businessInfo.industry) : '',
            location: businessInfo.location ? validateInput.sanitizeString(businessInfo.location) : ''
        };

        console.log('🔍 Analyzing business:', sanitizedBusinessInfo.name);

        // Use AI to extract additional info
        const analysis = await analyzeBusinessWithAI(sanitizedBusinessInfo);

        if (!analysis) {
            return res.status(500).json({
                error: 'Failed to analyze business information'
            });
        }

        res.json({
            success: true,
            extractedInfo: analysis
        });

    } catch (error) {
        console.error('Analysis error:', error);

        if (error.message.includes('quota') || error.message.includes('limit')) {
            return res.status(429).json({
                error: 'API quota exceeded. Please try again later.',
                retryAfter: 60
            });
        }

        if (error.message.includes('timeout')) {
            return res.status(408).json({
                error: 'Analysis request timed out. Please try again.'
            });
        }

        res.status(500).json({
            error: 'Failed to analyze business information. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Recreate website endpoint
app.post('/api/recreate', async (req, res) => {
    try {
        const { scrapedData, businessInfo, instructions, versionCount = 1 } = req.body;

        // Input validation
        if (!scrapedData) {
            return res.status(400).json({
                error: 'Scraped data is required',
                field: 'scrapedData'
            });
        }

        if (!businessInfo) {
            return res.status(400).json({
                error: 'Business information is required',
                field: 'businessInfo'
            });
        }

        if (!businessInfo.name || businessInfo.name.trim().length === 0) {
            return res.status(400).json({
                error: 'Business name is required',
                field: 'businessInfo.name'
            });
        }

        // Validate version count
        const numVersions = Math.min(Math.max(parseInt(versionCount) || 1, 1), 5); // Limit to 1-5 versions

        // Sanitize inputs
        const sanitizedBusinessInfo = {
            ...businessInfo,
            name: validateInput.sanitizeString(businessInfo.name),
            description: businessInfo.description ? validateInput.sanitizeString(businessInfo.description) : '',
            industry: businessInfo.industry ? validateInput.sanitizeString(businessInfo.industry) : ''
        };

        const sanitizedInstructions = instructions ? validateInput.sanitizeString(instructions) : '';

        console.log(`🤖 Generating ${numVersions} website version(s) for:`, sanitizedBusinessInfo.name);

        // Generate multiple versions
        const versions = [];
        for (let i = 0; i < numVersions; i++) {
            console.log(`   🎨 Creating version ${i + 1}/${numVersions}...`);

            // Add variation instruction for multiple versions
            const versionInstruction = numVersions > 1
                ? `${sanitizedInstructions}\n\n[Version ${i + 1}: Create a unique design variation with different layout, color scheme, or style approach]`
                : sanitizedInstructions;

            const newWebsite = await generateWebsiteWithAI(scrapedData, sanitizedBusinessInfo, versionInstruction);

            if (newWebsite) {
                versions.push({
                    ...newWebsite,
                    versionNumber: i + 1,
                    versionId: Math.random().toString(36).substring(2, 15)
                });
                console.log(`   ✅ Version ${i + 1} generated successfully`);
            } else {
                console.log(`   ⚠️ Version ${i + 1} generation failed`);
            }
        }

        if (versions.length === 0) {
            return res.status(500).json({
                error: 'Failed to generate any website versions'
            });
        }

        // Store all generated versions
        const projectId = Math.random().toString(36).substring(2, 15);
        generatedProjects.set(projectId, {
            versions,
            businessInfo: sanitizedBusinessInfo,
            timestamp: new Date()
        });

        // Automatically host the first version for live preview
        let hostedSite = null;
        try {
            hostedSite = await saveHostedWebsite(versions[0], sanitizedBusinessInfo);
            console.log('✅ Version 1 automatically hosted for live preview');
        } catch (error) {
            console.log('⚠️ Could not auto-host website, manual hosting still available');
        }

        console.log(`🎉 Generated ${versions.length} version(s) successfully`);

        res.json({
            versions,
            projectId,
            hostedSite,
            totalVersions: versions.length
        });

    } catch (error) {
        console.error('Recreation error:', error);

        if (error.message.includes('quota') || error.message.includes('limit')) {
            return res.status(429).json({
                error: 'API quota exceeded. Please try again later.',
                retryAfter: 60
            });
        }

        if (error.message.includes('timeout')) {
            return res.status(408).json({
                error: 'Website generation request timed out. Please try again.'
            });
        }

        res.status(500).json({
            error: 'Failed to generate website. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Generate outreach endpoint
app.post('/api/outreach', async (req, res) => {
    try {
        const { businessInfo, generatedWebsite, yourName, yourEmail, packagePrice } = req.body;

        // Input validation
        if (!businessInfo) {
            return res.status(400).json({
                error: 'Business information is required',
                field: 'businessInfo'
            });
        }

        if (!businessInfo.name || businessInfo.name.trim().length === 0) {
            return res.status(400).json({
                error: 'Business name is required',
                field: 'businessInfo.name'
            });
        }

        if (!generatedWebsite) {
            return res.status(400).json({
                error: 'Generated website information is required',
                field: 'generatedWebsite'
            });
        }

        if (!yourName || yourName.trim().length === 0) {
            return res.status(400).json({
                error: 'Your name is required for outreach',
                field: 'yourName'
            });
        }

        if (!yourEmail || !validateInput.email(yourEmail)) {
            return res.status(400).json({
                error: 'Valid email address is required',
                field: 'yourEmail'
            });
        }

        // Sanitize inputs
        const sanitizedBusinessInfo = {
            ...businessInfo,
            name: validateInput.sanitizeString(businessInfo.name),
            description: businessInfo.description ? validateInput.sanitizeString(businessInfo.description) : ''
        };

        const sanitizedYourName = validateInput.sanitizeString(yourName);
        const sanitizedYourEmail = yourEmail.trim().toLowerCase();
        const sanitizedPackagePrice = packagePrice ? validateInput.sanitizeString(packagePrice) : '';

        console.log('📧 Generating outreach for:', sanitizedBusinessInfo.name);

        // Generate outreach content with AI
        const outreach = await generateOutreachWithAI(sanitizedBusinessInfo, generatedWebsite, {
            yourName: sanitizedYourName,
            yourEmail: sanitizedYourEmail,
            packagePrice: sanitizedPackagePrice
        });

        if (!outreach) {
            return res.status(500).json({
                error: 'Failed to generate outreach content'
            });
        }

        res.json(outreach);

    } catch (error) {
        console.error('Outreach generation error:', error);

        if (error.message.includes('quota') || error.message.includes('limit')) {
            return res.status(429).json({
                error: 'API quota exceeded. Please try again later.',
                retryAfter: 60
            });
        }

        if (error.message.includes('timeout')) {
            return res.status(408).json({
                error: 'Outreach generation request timed out. Please try again.'
            });
        }

        res.status(500).json({
            error: 'Failed to generate outreach content. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Export package endpoint
app.post('/api/export-package', async (req, res) => {
    try {
        const { generatedWebsite, businessInfo, scrapedData } = req.body;

        console.log('📦 Creating export package for:', businessInfo.name);

        // Create ZIP package
        const packageBuffer = await createExportPackage(generatedWebsite, businessInfo, scrapedData);

        const businessName = businessInfo.name || 'Website';
        const fileName = `${businessName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_complete_package.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(packageBuffer);

    } catch (error) {
        console.error('Export package error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Project Management endpoints
app.post('/api/projects', async (req, res) => {
    try {
        const projectData = req.body;

        // Input validation
        if (!projectData) {
            return res.status(400).json({
                error: 'Project data is required',
                field: 'projectData'
            });
        }

        if (!projectData.name || !validateInput.projectName(projectData.name)) {
            return res.status(400).json({
                error: 'Project name must be between 3 and 50 characters',
                field: 'name'
            });
        }

        if (!projectData.businessInfo || !projectData.businessInfo.name) {
            return res.status(400).json({
                error: 'Business information is required',
                field: 'businessInfo'
            });
        }

        // Sanitize project data
        const sanitizedProjectData = {
            ...projectData,
            name: validateInput.sanitizeString(projectData.name),
            businessInfo: {
                ...projectData.businessInfo,
                name: validateInput.sanitizeString(projectData.businessInfo.name),
                description: projectData.businessInfo.description ? validateInput.sanitizeString(projectData.businessInfo.description) : ''
            }
        };

        console.log('💾 Saving project:', sanitizedProjectData.name);

        // Generate unique project ID
        const projectId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        // Store project with metadata
        const project = {
            id: projectId,
            ...sanitizedProjectData,
            savedAt: new Date().toISOString()
        };

        // Store in memory (in production, use a database)
        generatedProjects.set(projectId, project);

        res.json({
            success: true,
            projectId: projectId,
            message: 'Project saved successfully'
        });

    } catch (error) {
        console.error('Save project error:', error);
        res.status(500).json({
            error: 'Failed to save project. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.get('/api/projects', async (req, res) => {
    try {
        console.log('📂 Loading projects list');

        // Get all projects from memory storage
        const projects = Array.from(generatedProjects.values())
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)); // Sort by newest first

        res.json({
            success: true,
            projects: projects,
            total: projects.length
        });

    } catch (error) {
        console.error('Load projects error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    try {
        const projectId = req.params.id;

        // Input validation
        if (!projectId || projectId.trim().length === 0) {
            return res.status(400).json({
                error: 'Project ID is required',
                field: 'id'
            });
        }

        // Sanitize project ID (basic alphanumeric check)
        const sanitizedProjectId = projectId.replace(/[^a-zA-Z0-9]/g, '');
        if (sanitizedProjectId !== projectId) {
            return res.status(400).json({
                error: 'Invalid project ID format',
                field: 'id'
            });
        }

        console.log('📂 Loading project:', sanitizedProjectId);

        const project = generatedProjects.get(sanitizedProjectId);

        if (!project) {
            return res.status(404).json({
                error: 'Project not found',
                projectId: sanitizedProjectId
            });
        }

        res.json({
            success: true,
            project: project
        });

    } catch (error) {
        console.error('Load project error:', error);
        res.status(500).json({
            error: 'Failed to load project. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        const projectId = req.params.id;

        // Input validation
        if (!projectId || projectId.trim().length === 0) {
            return res.status(400).json({
                error: 'Project ID is required',
                field: 'id'
            });
        }

        // Sanitize project ID (basic alphanumeric check)
        const sanitizedProjectId = projectId.replace(/[^a-zA-Z0-9]/g, '');
        if (sanitizedProjectId !== projectId) {
            return res.status(400).json({
                error: 'Invalid project ID format',
                field: 'id'
            });
        }

        console.log('🗑️ Deleting project:', sanitizedProjectId);

        const existed = generatedProjects.has(sanitizedProjectId);

        if (!existed) {
            return res.status(404).json({
                error: 'Project not found',
                projectId: sanitizedProjectId
            });
        }

        generatedProjects.delete(sanitizedProjectId);

        res.json({
            success: true,
            message: 'Project deleted successfully',
            projectId: sanitizedProjectId
        });

    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({
            error: 'Failed to delete project. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Professional website scraping with full sitemap discovery and intelligent scraping
async function professionalScrapeWebsite(url) {
    try {
        console.log('🔥 Using Firecrawl for comprehensive sitemap scraping:', url);

        // First, map the website to discover all pages using Firecrawl /map endpoint
        console.log('📍 Mapping website to discover complete sitemap...');
        const mapResult = await firecrawl.map(url, {
            limit: 100, // Increased limit to discover more pages
            includeSubdomains: false, // Use camelCase as per Firecrawl docs
            ignoreSitemap: false // Use sitemap if available for faster discovery
        });

        if (!mapResult || !mapResult.links || mapResult.links.length === 0) {
            console.log(`⚠️ Mapping failed or no links found`);
            console.log('🔄 Falling back to single page scrape');
            return await scrapeSinglePage(url);
        }

        // Get discovered URLs - use all discovered pages for comprehensive analysis
        const allDiscoveredUrls = mapResult.links || [];
        console.log(`🗺️ Discovered ${allDiscoveredUrls.length} total pages from sitemap`);

        // Log first 10 for visibility
        allDiscoveredUrls.slice(0, 10).forEach((link, index) => {
            console.log(`   ${index + 1}. ${link.url || link} - ${link.title || 'No title'}`);
        });

        if (allDiscoveredUrls.length > 10) {
            console.log(`   ... and ${allDiscoveredUrls.length - 10} more pages`);
        }

        // Scrape multiple key pages instead of crawling
        console.log('🕷️ Starting comprehensive scraping of discovered pages...');
        const scrapedPages = [];

        // Prioritize homepage + key pages (about, services, contact, products, etc.)
        const priorityKeywords = ['about', 'service', 'contact', 'product', 'team', 'portfolio', 'pricing', 'features'];

        const priorityPages = allDiscoveredUrls.filter(link => {
            const linkUrl = (typeof link === 'string' ? link : link.url || '').toLowerCase();
            return priorityKeywords.some(keyword => linkUrl.includes(keyword));
        });

        const priorityUrls = [
            url, // Always include homepage first
            ...priorityPages.slice(0, 12).map(link => typeof link === 'string' ? link : link.url),
            ...allDiscoveredUrls.slice(0, 8).map(link => typeof link === 'string' ? link : link.url)
        ];

        // Remove duplicates and limit to 8 pages to respect rate limits (10 req/min with map call)
        const urlsToScrape = [...new Set(priorityUrls)].slice(0, 8);
        console.log(`📄 Scraping ${urlsToScrape.length} priority pages (${priorityPages.length} priority keywords matched)...`);

        // Scrape each priority page with rate limiting (6 second delay = max 10 requests/min)
        for (let i = 0; i < urlsToScrape.length; i++) {
            const pageUrl = urlsToScrape[i];
            try {
                console.log(`   📃 Scraping ${i + 1}/${urlsToScrape.length}: ${pageUrl}`);
                const pageResult = await firecrawl.scrape(pageUrl, {
                    formats: ['markdown', 'html'],
                    onlyMainContent: true,
                    includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'p', 'article', 'section'],
                    excludeTags: ['script', 'style', 'nav', 'footer', 'aside']
                });

                if (pageResult && pageResult.markdown) {
                    scrapedPages.push({
                        url: pageUrl,
                        markdown: pageResult.markdown,
                        html: pageResult.html,
                        metadata: pageResult.metadata,
                        content: pageResult.markdown
                    });
                    console.log(`   ✅ Successfully scraped: ${pageUrl}`);
                } else {
                    console.log(`   ⚠️ Failed to scrape: ${pageUrl}`);
                }

                // Add 6 second delay between requests to respect rate limits (10 req/min)
                if (i < urlsToScrape.length - 1) {
                    console.log(`   ⏳ Waiting 6s to respect rate limits...`);
                    await new Promise(resolve => setTimeout(resolve, 6000));
                }
            } catch (pageError) {
                console.log(`   ❌ Error scraping ${pageUrl}:`, pageError.message);

                // If rate limited, wait longer
                if (pageError.message && pageError.message.includes('Rate limit')) {
                    console.log(`   ⏳ Rate limited - waiting 60s before continuing...`);
                    await new Promise(resolve => setTimeout(resolve, 60000));
                }
            }
        }

        if (scrapedPages.length === 0) {
            console.log('❌ No pages could be scraped, falling back to enhanced scraping');
            return await enhancedScrapeWebsite(url);
        }

        console.log(`📖 Successfully scraped ${scrapedPages.length} pages`);

        // Aggregate content from all scraped pages
        let combinedContent = '';
        let mainTitle = '';
        let mainDescription = '';
        let allBusinessInfo = {};
        let allLinks = [];

        for (const page of scrapedPages) {
            const pageContent = page.markdown || page.content || '';
            const pageTitle = page.metadata?.title || '';
            const pageDescription = page.metadata?.description || '';

            // Use homepage data as primary
            if (page.url === url || !mainTitle) {
                mainTitle = pageTitle || extractTitleFromContent(pageContent);
                mainDescription = pageDescription || extractDescriptionFromContent(pageContent);
            }

            // Combine all content with page context
            combinedContent += `\n\n=== PAGE: ${page.url} ===\n`;
            combinedContent += `TITLE: ${pageTitle}\n`;
            combinedContent += `DESCRIPTION: ${pageDescription}\n`;
            combinedContent += `CONTENT: ${pageContent}\n`;

            // Extract business info from each page
            const pageBusinessInfo = extractBusinessInfo(pageContent);
            Object.assign(allBusinessInfo, pageBusinessInfo);

            // Extract links if available
            if (page.html) {
                const pageLinks = extractLinks(page.html, page.url);
                allLinks = allLinks.concat(pageLinks);
            }
        }

        // Remove duplicate links
        allLinks = [...new Set(allLinks)];

        const finalData = {
            title: mainTitle || 'Website Title',
            description: mainDescription || '',
            content: combinedContent.substring(0, 50000), // Display content
            fullContent: combinedContent, // Complete content for AI analysis
            links: allLinks,
            businessInfo: allBusinessInfo,
            sitemap: allDiscoveredUrls.map(link => typeof link === 'string' ? link : link.url), // Full sitemap
            metadata: {
                scrapedAt: new Date().toISOString(),
                url: url,
                method: 'firecrawl-sitemap-comprehensive',
                totalPagesDiscovered: allDiscoveredUrls.length,
                pagesScraped: scrapedPages.length,
                priorityPagesFound: priorityPages.length,
                wordCount: combinedContent.split(' ').length,
                hasContactInfo: !!(allBusinessInfo.email || allBusinessInfo.phone),
                scrapedUrls: scrapedPages.map(p => p.url),
                sitemapComplete: true
            }
        };

        console.log(`🎉 Comprehensive scraping complete: ${scrapedPages.length} pages, ${finalData.metadata.wordCount} words`);
        return finalData;

    } catch (error) {
        console.error('Firecrawl comprehensive scraping error:', error);
        console.log('🔄 Falling back to single page scrape');
        return await scrapeSinglePage(url);
    }
}

// Single page scraping fallback
async function scrapeSinglePage(url) {
    try {
        console.log('📄 Using Firecrawl single page scrape for:', url);

        const scrapeResult = await firecrawl.scrape(url, {
            formats: ['markdown', 'html'],
            includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'p', 'a', 'img'],
            excludeTags: ['script', 'style', 'nav', 'footer'],
            waitFor: 1000,
            timeout: 30000
        });

        if (!scrapeResult || !scrapeResult.markdown) {
            throw new Error('Failed to scrape website - no content returned');
        }

        // Extract business-relevant information
        const content = scrapeResult.markdown || '';
        const title = scrapeResult.metadata?.title || extractTitleFromContent(content);
        const description = scrapeResult.metadata?.description || extractDescriptionFromContent(content);

        // Extract contact information and business details
        const businessInfo = extractBusinessInfo(content);
        const links = extractLinks(scrapeResult.html || '', url);

        return {
            title: title || 'Website Title',
            description: description || '',
            content: content.substring(0, 10000),
            fullContent: content, // Keep full content for AI analysis
            links: links,
            businessInfo: businessInfo,
            metadata: {
                scrapedAt: new Date().toISOString(),
                url: url,
                method: 'firecrawl-single',
                wordCount: content.split(' ').length,
                hasContactInfo: !!(businessInfo.email || businessInfo.phone),
                ...scrapeResult.metadata
            }
        };

    } catch (error) {
        console.error('Single page Firecrawl error:', error);
        // Final fallback to enhanced scraping
        return await enhancedScrapeWebsite(url);
    }
}

// Enhanced website scraping (fallback)
async function enhancedScrapeWebsite(url) {
    try {
        console.log('📄 Using enhanced scraping for:', url);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();

        // Enhanced HTML parsing
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const descMatch = html.match(/<meta[^>]*name=[\"']description[\"'][^>]*content=[\"']([^\"']+)[\"']/i) ||
                         html.match(/<meta[^>]*property=[\"']og:description[\"'][^>]*content=[\"']([^\"']+)[\"']/i);

        // Extract structured text content with better parsing
        const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Extract business information
        const businessInfo = extractBusinessInfo(textContent);
        const links = extractLinks(html, url);

        const title = titleMatch ? titleMatch[1].trim() : 'Website Title';
        const description = descMatch ? descMatch[1].trim() : extractDescriptionFromContent(textContent);

        return {
            title: title,
            description: description,
            content: textContent.substring(0, 8000), // More content for better analysis
            fullContent: textContent, // Keep full content for AI analysis
            links: links,
            businessInfo: businessInfo,
            metadata: {
                scrapedAt: new Date().toISOString(),
                url: url,
                method: 'enhanced',
                wordCount: textContent.split(' ').length,
                hasContactInfo: !!(businessInfo.email || businessInfo.phone)
            }
        };

    } catch (error) {
        console.error('Enhanced scraping error:', error);
        // Final fallback
        return {
            title: 'Website Title',
            description: 'Website description not available',
            content: 'Could not extract content from this website. Please check the URL and try again.',
            links: [],
            businessInfo: {},
            metadata: {
                scrapedAt: new Date().toISOString(),
                url: url,
                method: 'fallback',
                error: error.message
            }
        };
    }
}

// Utility functions for content extraction
function extractBusinessInfo(content) {
    const businessInfo = {};

    // Extract email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailRegex);
    if (emails && emails.length > 0) {
        businessInfo.email = emails[0];
    }

    // Extract phone numbers
    const phoneRegex = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})|(\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g;
    const phones = content.match(phoneRegex);
    if (phones && phones.length > 0) {
        businessInfo.phone = phones[0];
    }

    // Extract address patterns
    const addressRegex = /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)[^,\n]*[,\s]*[A-Za-z\s]+[,\s]*[A-Z]{2}\s*\d{5}/g;
    const addresses = content.match(addressRegex);
    if (addresses && addresses.length > 0) {
        businessInfo.address = addresses[0];
    }

    return businessInfo;
}

function extractTitleFromContent(content) {
    // Extract title from first heading or first line
    const lines = content.split('\n').filter(line => line.trim());
    return lines.length > 0 ? lines[0].trim().substring(0, 100) : 'Website Title';
}

function extractDescriptionFromContent(content) {
    // Extract description from content
    const sentences = content.split('.').filter(s => s.trim().length > 20);
    return sentences.length > 0 ? sentences[0].trim().substring(0, 200) + '.' : '';
}

function extractLinks(html, baseUrl) {
    try {
        const linkMatches = html.match(/href=[\"']([^\"']+)[\"']/gi) || [];
        const links = linkMatches
            .map(link => {
                const url = link.replace(/href=[\"']([^\"']+)[\"']/, '$1');
                // Convert relative URLs to absolute
                if (url.startsWith('/')) {
                    const domain = new URL(baseUrl).origin;
                    return domain + url;
                }
                return url;
            })
            .filter(link => link.startsWith('http'))
            .filter((link, index, arr) => arr.indexOf(link) === index) // Remove duplicates
            .slice(0, 15);

        return links;
    } catch (error) {
        return [];
    }
}

// AI Business Analysis
async function analyzeBusinessWithAI(businessInfo) {
    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Get the complete scraped website data (use fullContent if available)
        const fullContent = businessInfo.scrapedData?.fullContent || businessInfo.scrapedData?.content || 'No content available';
        const websiteUrl = businessInfo.scrapedData?.url || 'Unknown URL';
        const metadata = businessInfo.scrapedData?.metadata || {};

        console.log(`🔍 AI analyzing ${fullContent.length} characters from ${metadata.pagesCrawled || 1} pages`);

        const prompt = `You are a business intelligence analyst. Analyze the website content below and extract specific business information.

WEBSITE DATA:
URL: ${websiteUrl}
Pages Analyzed: ${metadata.pagesScraped || metadata.pagesCrawled || 1}
Total Content Length: ${fullContent.length} characters

COMPLETE WEBSITE CONTENT:
${fullContent.substring(0, 100000)}

YOUR TASK: Extract business information and return ONLY a valid JSON object (no markdown, no explanations). The JSON must have these exact fields:

{
  "businessName": "exact business name",
  "industry": "specific industry (e.g., Hospitality & Tourism, Restaurant Chain, Resort Management)",
  "owner": "owner/founder/CEO name if found, or leave empty",
  "email": "primary contact email if found",
  "phone": "primary phone number if found",
  "services": "comma-separated list of main services/products (e.g., Beach Resorts, Restaurants, Vacation Rentals, Merchandise)",
  "issues": "list 2-3 potential website improvement areas (e.g., Mobile optimization needed, Add live chat, Improve booking flow)",
  "location": "headquarters or main location",
  "description": "2-3 sentence company description"
}

EXTRACTION RULES:
- businessName: Use the exact company name from the website
- industry: Be specific and descriptive
- services: List 3-5 main offerings, comma-separated
- issues: Identify real website problems (navigation, mobile issues, missing features, outdated design)
- If information is not found, use empty string ""
- Return ONLY the JSON object, no other text

RETURN ONLY VALID JSON:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        console.log('🤖 Raw AI Response:', text.substring(0, 500));

        // Clean up markdown formatting if present
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Try to parse JSON response
        try {
            const parsed = JSON.parse(text);
            console.log('✅ AI Analysis Result:', JSON.stringify(parsed, null, 2));
            return parsed;
        } catch (parseError) {
            console.error('❌ Failed to parse AI response as JSON:', parseError.message);
            console.log('📄 Attempting to extract info from text...');

            // Fallback: try to extract structured data from text
            return {
                businessName: businessInfo.name || extractEmailFromText(text) || '',
                industry: '',
                owner: extractOwnerFromText(text) || '',
                email: extractEmailFromText(text) || '',
                phone: extractPhoneFromText(text) || '',
                services: businessInfo.services || '',
                issues: '',
                location: '',
                description: text.substring(0, 200)
            };
        }

    } catch (error) {
        console.error('AI Analysis error:', error);
        return {
            analysis: 'Could not analyze with AI',
            extractedInfo: {}
        };
    }
}

// AI Website Generation
async function generateWebsiteWithAI(scrapedData, businessInfo, instructions) {
    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Create a complete, modern HTML website for this business:

Business: ${businessInfo.name}
Industry: ${businessInfo.industry}
Services: ${businessInfo.services}
Current Website Content: ${scrapedData?.content?.substring(0, 50000) || 'No content'}

Instructions: ${instructions}

Create a complete HTML page with:
- Modern, professional design
- Responsive layout using Tailwind CSS
- Hero section with compelling headline
- Services/products section
- About section
- Contact section with form
- Professional color scheme
- Mobile-friendly design

Return ONLY the complete HTML code, no explanations.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const html = response.text();

        // Clean up the HTML (remove markdown formatting if present)
        const cleanHtml = html
            .replace(/```html/g, '')
            .replace(/```/g, '')
            .trim();

        return {
            html: cleanHtml,
            title: `Modern ${businessInfo.name} Website`,
            description: `AI-generated modern website for ${businessInfo.name}`,
            generatedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('AI Website Generation error:', error);

        // Return fallback website
        return {
            html: generateFallbackWebsite(businessInfo),
            title: `${businessInfo.name} Website`,
            description: `Professional website for ${businessInfo.name}`,
            generatedAt: new Date().toISOString(),
            error: error.message
        };
    }
}

// AI Outreach Generation
async function generateOutreachWithAI(businessInfo, generatedWebsite, outreachInfo) {
    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const emailPrompt = `Create a professional cold email for web design services:

Target Business: ${businessInfo.name}
Industry: ${businessInfo.industry}
Current Issues: ${businessInfo.issues}
Your Name: ${outreachInfo.yourName}
Your Email: ${outreachInfo.yourEmail}
Package Price: ${outreachInfo.packagePrice}

Create a compelling cold email that:
- Has an attention-grabbing subject line
- Addresses their specific pain points
- Offers a solution (new website)
- Shows value and professionalism
- Includes a clear call to action
- Keep it concise (under 200 words)

Format as:
Subject: [subject line]

[email body]`;

        const proposalPrompt = `Create a detailed website redesign proposal:

Client: ${businessInfo.name}
Industry: ${businessInfo.industry}
Services: ${businessInfo.services}
Current Issues: ${businessInfo.issues}
Price: ${outreachInfo.packagePrice}
Your Company: ${outreachInfo.yourName}

Create a professional proposal including:
- Executive summary
- Current website analysis
- Proposed solution
- Key features and benefits
- Timeline (suggest 2-3 weeks)
- Investment breakdown
- Next steps

Make it compelling and professional.`;

        // Generate both in parallel
        const [emailResult, proposalResult] = await Promise.all([
            model.generateContent(emailPrompt),
            model.generateContent(proposalPrompt)
        ]);

        const email = (await emailResult.response).text();
        const proposal = (await proposalResult.response).text();

        return {
            email: email.trim(),
            proposal: proposal.trim(),
            generatedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('AI Outreach Generation error:', error);

        // Return fallback outreach
        return {
            email: generateFallbackEmail(businessInfo, outreachInfo),
            proposal: generateFallbackProposal(businessInfo, outreachInfo),
            generatedAt: new Date().toISOString(),
            error: error.message
        };
    }
}

// Fallback website generator
function generateFallbackWebsite(businessInfo) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${businessInfo.name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <header class="bg-blue-600 text-white">
        <div class="container mx-auto px-6 py-4">
            <h1 class="text-3xl font-bold">${businessInfo.name}</h1>
        </div>
    </header>

    <main class="container mx-auto px-6 py-12">
        <section class="text-center mb-12">
            <h2 class="text-4xl font-bold text-gray-800 mb-4">Welcome to ${businessInfo.name}</h2>
            <p class="text-xl text-gray-600">${businessInfo.services || 'Professional services you can trust'}</p>
        </section>

        <section class="grid md:grid-cols-3 gap-8 mb-12">
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-xl font-bold mb-4">Our Services</h3>
                <p class="text-gray-600">${businessInfo.services || 'Quality services tailored to your needs.'}</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-xl font-bold mb-4">About Us</h3>
                <p class="text-gray-600">Experienced professionals in ${businessInfo.industry || 'our field'}.</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-xl font-bold mb-4">Contact</h3>
                <p class="text-gray-600">Get in touch for a consultation.</p>
            </div>
        </section>
    </main>

    <footer class="bg-gray-800 text-white py-8">
        <div class="container mx-auto px-6 text-center">
            <p>&copy; 2025 ${businessInfo.name}. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>`;
}

// Fallback email generator
function generateFallbackEmail(businessInfo, outreachInfo) {
    return `Subject: Quick Question About ${businessInfo.name}'s Website

Hi there,

I was looking at ${businessInfo.name}'s website and noticed a few areas where we might be able to help you get more customers online.

I specialize in creating modern, mobile-friendly websites that convert visitors into customers. I'd love to show you what a new website could look like for ${businessInfo.name}.

Would you be interested in seeing a quick mockup? No obligation - just want to show you the potential.

Best regards,
${outreachInfo.yourName}
${outreachInfo.yourEmail}

P.S. - I'm offering complete website redesigns starting at ${outreachInfo.packagePrice}`;
}

// Fallback proposal generator
function generateFallbackProposal(businessInfo, outreachInfo) {
    return `WEBSITE REDESIGN PROPOSAL
${businessInfo.name}

EXECUTIVE SUMMARY
This proposal outlines a complete website redesign for ${businessInfo.name} to improve online presence and customer acquisition.

CURRENT SITUATION
Your current website has several opportunities for improvement that could be limiting your business growth.

PROPOSED SOLUTION
- Modern, mobile-responsive design
- Fast loading times
- Professional appearance
- Contact forms and lead capture
- SEO optimization

INVESTMENT
Complete website redesign: ${outreachInfo.packagePrice}

TIMELINE
Project completion: 2-3 weeks

NEXT STEPS
Reply to this email to get started on your new website.

${outreachInfo.yourName}
${outreachInfo.yourEmail}`;
}

// Utility functions
function extractEmailFromText(text) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = text.match(emailRegex);
    return match ? match[0] : null;
}

function extractPhoneFromText(text) {
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
    const match = text.match(phoneRegex);
    return match ? match[0] : null;
}

function extractOwnerFromText(text) {
    // Simple extraction - would need more sophisticated NLP in production
    const ownerPatterns = ['owner:', 'founder:', 'ceo:', 'president:'];
    for (const pattern of ownerPatterns) {
        const regex = new RegExp(pattern + '\\s*([^\\n,]+)', 'i');
        const match = text.match(regex);
        if (match) return match[1].trim();
    }
    return null;
}

// Create export package function
async function createExportPackage(generatedWebsite, businessInfo, scrapedData) {
    const archiver = require('archiver');
    const { Readable } = require('stream');

    return new Promise((resolve, reject) => {
        const buffers = [];
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('data', (chunk) => buffers.push(chunk));
        archive.on('end', () => resolve(Buffer.concat(buffers)));
        archive.on('error', reject);

        // Add main website HTML
        archive.append(generatedWebsite.html, {
            name: 'index.html',
            comment: 'Main website HTML file'
        });

        // Add business information file
        const businessInfoContent = `# Business Information
Business Name: ${businessInfo.name || 'N/A'}
Industry: ${businessInfo.industry || 'N/A'}
Owner: ${businessInfo.owner || 'N/A'}
Email: ${businessInfo.email || 'N/A'}
Services: ${businessInfo.services || 'N/A'}
Issues Identified: ${businessInfo.issues || 'N/A'}

Generated: ${new Date().toISOString()}
`;
        archive.append(businessInfoContent, { name: 'business-info.txt' });

        // Add scraped data analysis
        if (scrapedData) {
            const scrapedAnalysis = `# Original Website Analysis
Title: ${scrapedData.title || 'N/A'}
Description: ${scrapedData.description || 'N/A'}
URL: ${scrapedData.url || 'N/A'}
Scraped: ${scrapedData.metadata?.scrapedAt || 'N/A'}
Method: ${scrapedData.metadata?.method || 'N/A'}
Word Count: ${scrapedData.metadata?.wordCount || 'N/A'}

## Content Preview:
${scrapedData.content ? scrapedData.content.substring(0, 2000) + '...' : 'No content'}

## Extracted Links:
${scrapedData.links ? scrapedData.links.slice(0, 10).join('\n') : 'No links found'}
`;
            archive.append(scrapedAnalysis, { name: 'original-website-analysis.txt' });
        }

        // Add README with instructions
        const readmeContent = `# Website Package

This package contains your newly generated website and related files.

## Files Included:
- index.html - Your new website (ready to upload)
- business-info.txt - Business information used for generation
- original-website-analysis.txt - Analysis of your original website
- README.md - This file

## How to Use:
1. Open index.html in a web browser to preview your new website
2. Upload index.html to your web hosting provider
3. Review the business information and analysis files for insights

## Generated by:
SiteClone Pro - AppSumo Website Scraper & Builder
Generated: ${new Date().toISOString()}

## Next Steps:
1. Test the website thoroughly
2. Customize any content as needed
3. Upload to your hosting provider
4. Update DNS settings if necessary

For support, contact your web developer.
`;
        archive.append(readmeContent, { name: 'README.md' });

        // Finalize the archive
        archive.finalize();
    });
}

// Website hosting functions
async function saveHostedWebsite(websiteData, businessInfo) {
    try {
        // Generate unique site ID
        const siteId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        // Create hosted directory
        const hostedDir = path.join(__dirname, 'hosted-sites', siteId);
        await fs.mkdir(hostedDir, { recursive: true });

        // Save the website HTML
        const htmlPath = path.join(hostedDir, 'index.html');
        await fs.writeFile(htmlPath, websiteData.html);

        // Save metadata
        const metaPath = path.join(hostedDir, 'meta.json');
        const metadata = {
            siteId,
            businessName: businessInfo.name,
            createdAt: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            viewCount: 0
        };
        await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

        console.log(`🌐 Website hosted at: http://localhost:${process.env.PORT || 3003}/hosted/${siteId}`);

        return {
            siteId,
            url: `http://localhost:${process.env.PORT || 3003}/hosted/${siteId}`,
            metadata
        };
    } catch (error) {
        console.error('Error saving hosted website:', error);
        throw error;
    }
}

async function updateSiteVisit(siteId) {
    try {
        const metaPath = path.join(__dirname, 'hosted-sites', siteId, 'meta.json');
        const metadata = JSON.parse(await fs.readFile(metaPath, 'utf8'));

        metadata.viewCount = (metadata.viewCount || 0) + 1;
        metadata.lastAccessed = new Date().toISOString();

        await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
        return metadata;
    } catch (error) {
        console.error('Error updating site visit:', error);
        return null;
    }
}

// Hosted website endpoints
app.get('/hosted/:siteId', async (req, res) => {
    try {
        const siteId = req.params.siteId;

        // Validate site ID
        const sanitizedSiteId = siteId.replace(/[^a-zA-Z0-9]/g, '');
        if (sanitizedSiteId !== siteId) {
            return res.status(400).send('Invalid site ID format');
        }

        const htmlPath = path.join(__dirname, 'hosted-sites', sanitizedSiteId, 'index.html');

        try {
            // Check if file exists
            await fs.access(htmlPath);

            // Update visit count
            await updateSiteVisit(sanitizedSiteId);

            // Serve the HTML file
            res.sendFile(htmlPath);
        } catch (error) {
            res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Site Not Found</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .error { color: #e74c3c; }
                    </style>
                </head>
                <body>
                    <h1 class="error">Website Not Found</h1>
                    <p>The requested website could not be found or may have been removed.</p>
                    <a href="/">← Back to SiteClone Pro</a>
                </body>
                </html>
            `);
        }
    } catch (error) {
        console.error('Error serving hosted website:', error);
        res.status(500).send('Internal server error');
    }
});

// Host a website endpoint
app.post('/api/host-website', async (req, res) => {
    try {
        const { websiteData, businessInfo } = req.body;

        // Input validation
        if (!websiteData || !websiteData.html) {
            return res.status(400).json({
                error: 'Website HTML data is required',
                field: 'websiteData.html'
            });
        }

        if (!businessInfo || !businessInfo.name) {
            return res.status(400).json({
                error: 'Business information is required',
                field: 'businessInfo.name'
            });
        }

        // Sanitize business info
        const sanitizedBusinessInfo = {
            ...businessInfo,
            name: validateInput.sanitizeString(businessInfo.name)
        };

        console.log('🌐 Hosting website for:', sanitizedBusinessInfo.name);

        // Save and host the website
        const hostingResult = await saveHostedWebsite(websiteData, sanitizedBusinessInfo);

        res.json({
            success: true,
            ...hostingResult,
            message: 'Website hosted successfully'
        });

    } catch (error) {
        console.error('Website hosting error:', error);
        res.status(500).json({
            error: 'Failed to host website. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// List hosted websites endpoint
app.get('/api/hosted-sites', async (req, res) => {
    try {
        const hostedDir = path.join(__dirname, 'hosted-sites');

        try {
            const siteIds = await fs.readdir(hostedDir);
            const sites = [];

            for (const siteId of siteIds) {
                try {
                    const metaPath = path.join(hostedDir, siteId, 'meta.json');
                    const metadata = JSON.parse(await fs.readFile(metaPath, 'utf8'));
                    sites.push({
                        ...metadata,
                        url: `http://localhost:${process.env.PORT || 3003}/hosted/${siteId}`
                    });
                } catch (error) {
                    // Skip invalid sites
                    continue;
                }
            }

            // Sort by creation date (newest first)
            sites.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            res.json({
                success: true,
                sites,
                total: sites.length
            });

        } catch (error) {
            // Directory doesn't exist yet
            res.json({
                success: true,
                sites: [],
                total: 0
            });
        }

    } catch (error) {
        console.error('Error listing hosted sites:', error);
        res.status(500).json({
            error: 'Failed to list hosted sites',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: '🚀 App Sumo Website Scraper & Builder API',
        timestamp: new Date().toISOString(),
        endpoints: [
            'POST /api/scrape - Scrape website data',
            'POST /api/analyze - Analyze business info',
            'POST /api/recreate - Generate new website',
            'POST /api/outreach - Generate outreach materials',
            'POST /api/export-package - Export complete website package',
            'GET /api/projects - List all saved projects',
            'POST /api/projects - Save a new project',
            'GET /api/projects/:id - Load a specific project',
            'DELETE /api/projects/:id - Delete a project',
            'POST /api/host-website - Host a generated website',
            'GET /api/hosted-sites - List all hosted websites',
            'GET /hosted/:siteId - View a hosted website'
        ]
    });
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3003;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 App Sumo Website Scraper & Builder running on http://localhost:${PORT}`);
    console.log(`🤖 Gemini API: ${process.env.GOOGLE_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🔥 Firecrawl API: ${firecrawl ? '✅ Professional scraping enabled' : '⚠️ Using enhanced fallback scraping'}`);
    console.log(`🕷️ Ready to scrape and build websites with ${firecrawl ? 'professional' : 'enhanced'} capabilities!`);
});
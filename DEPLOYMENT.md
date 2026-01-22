# Vercel Deployment Guide

## Overview

This application is optimized for deployment on Vercel's serverless platform. The Express.js server automatically adapts to run as a serverless function while maintaining full local development capabilities.

## Prerequisites

1. A [Vercel account](https://vercel.com/signup)
2. [Vercel CLI](https://vercel.com/docs/cli) installed (optional, for CLI deployment)
3. Required API keys (see Environment Variables section)

## Deployment Methods

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Connect Repository**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your Git repository (GitHub, GitLab, or Bitbucket)

2. **Configure Project**
   - Vercel will auto-detect the configuration from `vercel.json`
   - No build settings changes needed

3. **Set Environment Variables**
   - In project settings, add the following environment variables:
     - `GOOGLE_API_KEY` - Your Google Gemini API key
     - `FIRECRAWL_API_KEY` - Your Firecrawl API key
     - `OPENAI_API_KEY` - (Optional) Your OpenAI API key
     - `ANTHROPIC_API_KEY` - (Optional) Your Anthropic Claude API key
     - `E2B_API_KEY` - (Optional) Your E2B API key

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your application

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   # For production deployment
   vercel --prod

   # For preview deployment
   vercel
   ```

4. **Set Environment Variables**
   ```bash
   vercel env add GOOGLE_API_KEY
   vercel env add FIRECRAWL_API_KEY
   vercel env add OPENAI_API_KEY
   vercel env add ANTHROPIC_API_KEY
   vercel env add E2B_API_KEY
   ```

## Environment Variables

### Required Variables

- **GOOGLE_API_KEY**: Google Gemini API key for AI-powered features
  - Get it from: [Google AI Studio](https://makersuite.google.com/app/apikey)

- **FIRECRAWL_API_KEY**: Firecrawl API key for professional web scraping
  - Get it from: [Firecrawl](https://www.firecrawl.dev/)

### Optional Variables

- **OPENAI_API_KEY**: OpenAI API key (for GPT models)
  - Get it from: [OpenAI Platform](https://platform.openai.com/api-keys)

- **ANTHROPIC_API_KEY**: Anthropic API key (for Claude models)
  - Get it from: [Anthropic Console](https://console.anthropic.com/)

- **E2B_API_KEY**: E2B API key (for code execution environment)
  - Get it from: [E2B](https://e2b.dev/)

## Configuration Files

### vercel.json

The `vercel.json` file contains all deployment configuration:

- **Builds**: Configures server.js as a Node.js serverless function
- **Routes**: Maps all API and static routes correctly
- **Functions**: Sets memory (3008MB) and timeout (60s) for serverless functions
- **Regions**: Deploys to IAD1 (US East) region

### Server Configuration

The `server.js` file has been modified to:
- Export the Express app for Vercel's serverless environment
- Only start a local server when run directly (not in Vercel)
- Support both local development and serverless deployment

## Local Development

To run the application locally:

```bash
# Install dependencies
npm install

# Create .env file with your API keys
cp .env.example .env

# Start the development server
npm start
```

The server will run on `http://localhost:3003`

## Vercel-Specific Optimizations

1. **Serverless Function Size**: Configured to 50MB to handle large scraped content
2. **Memory Allocation**: 3008MB for AI processing and web scraping operations
3. **Function Timeout**: 60 seconds (Vercel's maximum for Hobby/Pro plans)
4. **Region**: IAD1 (US East) for optimal performance
5. **Static File Serving**: Optimized routing for HTML, CSS, JS, and media files

## Important Notes

### File Storage Limitations

Vercel's serverless functions have ephemeral file systems. The `/hosted-sites` directory will NOT persist between function invocations. Consider these alternatives:

1. **Vercel Blob Storage**: For storing generated websites
   - Add `@vercel/blob` to dependencies
   - Update code to use Blob storage instead of local filesystem

2. **External Storage**: AWS S3, Google Cloud Storage, or Cloudflare R2
   - Store generated sites externally
   - Update API endpoints to retrieve from external storage

3. **Database Storage**: Store HTML content in a database
   - Use Vercel Postgres, MongoDB Atlas, or similar
   - Modify storage logic in server.js

### API Rate Limits

Be aware of Vercel's function invocation limits:
- Hobby Plan: 100GB-hours/month
- Pro Plan: 1000GB-hours/month

Monitor usage in Vercel dashboard to avoid overages.

## Troubleshooting

### Common Issues

1. **500 Internal Server Error**
   - Check environment variables are set correctly
   - Review function logs in Vercel dashboard
   - Ensure API keys are valid

2. **Timeout Errors**
   - Web scraping operations may exceed 60s limit
   - Consider implementing async processing with background jobs
   - Split large operations into smaller chunks

3. **Module Not Found Errors**
   - Ensure all dependencies are in `package.json`
   - Run `npm install` locally to verify
   - Check that `node_modules` is in `.vercelignore`

4. **Static Files Not Loading**
   - Verify routes configuration in `vercel.json`
   - Check file paths are correct
   - Ensure files are not in `.vercelignore`

## Production Checklist

- [ ] All environment variables configured in Vercel
- [ ] API keys tested and working
- [ ] Function timeout appropriate for workload
- [ ] Storage solution implemented (if using hosted sites)
- [ ] Error monitoring configured (Sentry, LogRocket, etc.)
- [ ] Rate limiting implemented for API endpoints
- [ ] CORS settings reviewed for production domains
- [ ] Security headers configured
- [ ] Custom domain configured (optional)

## Monitoring and Logs

Access logs and metrics in the Vercel dashboard:

1. Go to your project in Vercel
2. Click "Logs" tab for real-time function logs
3. Click "Analytics" for usage metrics
4. Set up integrations for advanced monitoring

## Support

For Vercel-specific issues:
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)

For application issues:
- Review server logs
- Check API key configuration
- Verify API service status

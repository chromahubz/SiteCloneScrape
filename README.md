# SiteClone Pro

An AI-powered website scraping, recreation, and lead generation tool designed for agencies and entrepreneurs.

## Features

- **Professional Web Scraping**: Extract content and structure from any live website using Firecrawl
- **AI-Powered Analysis**: Automatically analyze business information and extract key insights
- **Website Recreation**: Generate modern, professional versions of scraped websites with AI
- **Outreach Automation**: Create personalized cold emails and professional proposals automatically
- **Multi-Version Generation**: Create multiple website variations to choose from
- **Project Management**: Save, organize, and manage multiple website projects
- **Website Hosting**: Deploy generated sites directly on the platform
- **BYO API Keys**: Bring your own API keys for full control

## Tech Stack

### Backend
- Node.js with Express.js 5.1.0
- Google Gemini AI (default)
- OpenAI GPT-4o (optional)
- Anthropic Claude Sonnet 4.5 (optional)
- Firecrawl API for web scraping

### Frontend
- HTML5 + Tailwind CSS
- Vanilla JavaScript
- Font Awesome icons
- Responsive design

## Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SiteCloneScrape
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your API keys:
   - `GOOGLE_API_KEY` - Required for AI features
   - `FIRECRAWL_API_KEY` - Required for web scraping
   - `OPENAI_API_KEY` - Optional (for GPT models)
   - `ANTHROPIC_API_KEY` - Optional (for Claude models)

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:3003
   ```

## Deployment

### Vercel (Recommended)

This application is optimized for Vercel deployment with serverless functions.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick Deploy to Vercel:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/SiteCloneScrape)

Remember to configure environment variables in Vercel dashboard after deployment.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scrape` | POST | Scrape website content |
| `/api/analyze` | POST | Analyze business information |
| `/api/recreate` | POST | Generate new website versions |
| `/api/modify-website` | POST | Apply modifications to website |
| `/api/outreach` | POST | Generate outreach materials |
| `/api/export-package` | POST | Export project as ZIP |
| `/api/projects` | POST/GET/DELETE | Manage projects |
| `/api/host-website` | POST | Deploy website to platform |
| `/api/config/save` | POST | Save API configuration |
| `/api/config/get` | GET | Get current configuration |
| `/api/config/test` | POST | Test API connections |

## Project Structure

```
SiteCloneScrape/
├── server.js              # Express server & API endpoints
├── index.html             # Main application UI
├── script.js              # Frontend logic
├── package.json           # Dependencies
├── vercel.json            # Vercel configuration
├── .env                   # Environment variables (not in repo)
├── hosted-sites/          # Generated website storage
└── pages/                 # Informational pages
    ├── features/
    ├── support/
    └── legal/
```

## Configuration

### LLM Providers

The application supports multiple AI providers:

1. **Google Gemini** (Default)
   - Model: `gemini-2.5-flash`
   - Fast and cost-effective

2. **OpenAI**
   - Model: `gpt-5`
   - High-quality outputs

3. **Anthropic Claude**
   - Model: `claude-sonnet-4-5-20250929`
   - Advanced reasoning capabilities

Configure your preferred provider in the application settings or use the BYO API feature.

## Usage

1. **Scrape a Website**
   - Enter the target website URL
   - Click "Scrape Website"
   - Review scraped content and metadata

2. **Analyze Business Info**
   - AI automatically extracts business insights
   - Review and edit as needed

3. **Recreate Website**
   - Generate multiple modern website versions
   - Preview and select your favorite
   - Apply custom modifications

4. **Generate Outreach**
   - Create personalized cold emails
   - Generate professional proposals
   - Copy and use in your campaigns

5. **Export or Host**
   - Export as ZIP package
   - Or host directly on the platform

## Important Notes

### Vercel Deployment Considerations

When deployed to Vercel:
- Function timeout is 60 seconds (may need optimization for large sites)
- File system is ephemeral (hosted sites won't persist)
- Consider using Vercel Blob Storage or external storage for hosted sites

See [DEPLOYMENT.md](./DEPLOYMENT.md) for solutions and best practices.

## License

ISC

## Support

For issues or questions:
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment troubleshooting
- Review API documentation above
- Ensure all environment variables are configured correctly

## Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

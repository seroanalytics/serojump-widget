# GitHub Pages Deployment

This repository is set up for automatic deployment to GitHub Pages using GitHub Actions.

## Setup Instructions

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Add GitHub Pages deployment"
   git push origin main
   ```

2. **Enable GitHub Pages in your repository**:
   - Go to your repository on GitHub
   - Click on "Settings" tab
   - Scroll down to "Pages" section
   - Under "Source", select "GitHub Actions"
   - The workflow will automatically deploy from the `web/` directory

3. **Access your site**:
   - Your site will be available at: `https://[your-username].github.io/[repository-name]`
   - For example: `https://davidhodgson.github.io/serojump`

## How it works

- The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically runs on every push to the main branch
- It deploys the contents of the `web/` directory to GitHub Pages
- No build step is required since this is a static HTML/JS/CSS site

## File Structure

```
serojump/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions workflow
├── web/
│   ├── index.html              # Main page
│   ├── serojump-app.js         # Application logic
│   ├── serojump_module.js      # WebAssembly module
│   ├── serojump_hex.png        # Logo
│   └── sample_data.csv         # Sample data
└── DEPLOYMENT.md               # This file
```

## Troubleshooting

- If deployment fails, check the "Actions" tab in your GitHub repository
- Make sure the `web/` directory contains all necessary files
- Ensure your repository is public (required for free GitHub Pages)

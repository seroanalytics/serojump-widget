#!/bin/bash

# Setup script for GitHub Pages deployment
echo "Setting up GitHub Pages deployment for serojump..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
fi

# Add all files
echo "Adding files to git..."
git add .

# Create initial commit
echo "Creating initial commit..."
git commit -m "Initial commit: Add serojump web application with GitHub Pages deployment"

# Check if remote exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo ""
    echo "⚠️  No remote repository found!"
    echo "Please create a repository on GitHub first, then run:"
    echo "git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git"
    echo "git push -u origin main"
    echo ""
    echo "After pushing, enable GitHub Pages in your repository settings:"
    echo "1. Go to Settings > Pages"
    echo "2. Select 'GitHub Actions' as the source"
    echo "3. Your site will be available at: https://YOUR_USERNAME.github.io/YOUR_REPO_NAME"
else
    echo "Pushing to remote repository..."
    git push -u origin main
    echo ""
    echo "✅ Setup complete! Your site should be available shortly at:"
    echo "https://YOUR_USERNAME.github.io/YOUR_REPO_NAME"
fi

echo ""
echo "📁 Files included in deployment:"
echo "- web/index.html (main page)"
echo "- web/serojump-app.js (application)"
echo "- web/serojump_module.js (WebAssembly)"
echo "- web/serojump_hex.png (logo)"
echo "- web/sample_data.csv (sample data)"
echo ""
echo "🔧 GitHub Actions workflow: .github/workflows/deploy.yml"
echo "📖 Deployment instructions: DEPLOYMENT.md"

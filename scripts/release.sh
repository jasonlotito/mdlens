#!/bin/bash

# mdlens Release Script
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.2.0

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 1.2.0"
    exit 1
fi

VERSION=$1
TAG="v$VERSION"

echo "🚀 Preparing release $TAG"

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Please switch to main branch before releasing"
    echo "Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Working directory is not clean. Please commit or stash changes."
    git status --short
    exit 1
fi

# Update package.json version
echo "📝 Updating package.json version to $VERSION"
npm version $VERSION --no-git-tag-version

# Commit version change
echo "💾 Committing version change"
git add package.json
git commit -m "Bump version to $VERSION"

# Create and push tag
echo "🏷️  Creating and pushing tag $TAG"
git tag $TAG
git push origin main
git push origin $TAG

echo "✅ Release $TAG has been created!"
echo ""
echo "🔄 GitHub Actions will now:"
echo "   • Build the app for macOS, Windows, and Linux"
echo "   • Create a GitHub Release"
echo "   • Upload installers to the release"
echo ""
echo "📋 Monitor the build progress at:"
echo "   https://github.com/jasonlotito/mdlens/actions"
echo ""
echo "🎉 Release will be available at:"
echo "   https://github.com/jasonlotito/mdlens/releases/tag/$TAG"

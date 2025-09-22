# Release Process

This document describes how to create releases for mdlens.

## Automated Releases

mdlens uses GitHub Actions to automatically build and release the application for all platforms when you create a new version tag.

### Creating a Release

1. **Update the version** in `package.json`:
   ```json
   {
     "version": "1.2.0"
   }
   ```

2. **Commit the version change**:
   ```bash
   git add package.json
   git commit -m "Bump version to 1.2.0"
   ```

3. **Create and push a version tag**:
   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```

4. **GitHub Actions will automatically**:
   - Build the app for macOS, Windows, and Linux
   - Create a GitHub Release with the tag
   - Upload the built installers to the release

### Release Artifacts

The automated build process creates:

- **macOS**: `mdlens-v1.2.0-macos.dmg`
- **Windows**: `mdlens-v1.2.0-windows.exe` 
- **Linux**: `mdlens-v1.2.0-linux.AppImage`

## Manual Testing

To test builds locally before releasing:

```bash
# Build for current platform only
npm run build

# Build for specific platforms
npm run build:mac     # macOS DMG
npm run build:win     # Windows installer
npm run build:linux  # Linux AppImage

# Build for all platforms (requires platform-specific dependencies)
npm run build -- --mac --win --linux
```

## Manual Release (if needed)

If you need to create a release manually:

1. **Build the applications**:
   ```bash
   npm run build
   ```

2. **Create a GitHub Release**:
   - Go to the GitHub repository
   - Click "Releases" → "Create a new release"
   - Choose your tag version
   - Upload the files from the `dist/` directory

## Workflow Files

- `.github/workflows/build.yml` - Main build and release workflow
- `.github/workflows/release.yml` - Alternative detailed workflow (backup)

## Requirements

The GitHub Actions workflow requires:
- Node.js 18
- The `GITHUB_TOKEN` secret (automatically provided by GitHub)
- The repository must have "Actions" enabled

## File Associations

The built installers will automatically register mdlens as a handler for:
- `.md` files
- `.markdown` files  
- `.mdown` files
- `.mkd` files

Users can set mdlens as their default markdown editor through their operating system's file association settings.

## Troubleshooting

### Build Fails
- Check that all dependencies are properly listed in `package.json`
- Ensure the version number follows semantic versioning (e.g., `1.2.0`)
- Verify that the GitHub token has the necessary permissions

### EEXIST Link Error
If you see `EEXIST: file already exists, link` errors:
- The build process automatically cleans `dist/` and `build/` directories
- This prevents symlink conflicts from previous builds
- If the error persists, manually run `npm run clean` before building

### Release Not Created
- Make sure you pushed the tag: `git push origin v1.2.0`
- Check that the tag name starts with `v` (e.g., `v1.2.0`)
- Verify the GitHub Actions workflow completed successfully

### Missing Artifacts
- Check the GitHub Actions logs for build errors
- Ensure all platforms built successfully
- Verify the artifact upload steps completed

### Icon Warnings
- The build shows "default Electron icon is used" - this is normal
- Custom icons can be added later by placing icon files in the `build/` directory
- File associations work without custom icons

## Version Numbering

Follow semantic versioning:
- **Major** (1.0.0): Breaking changes
- **Minor** (1.1.0): New features, backwards compatible
- **Patch** (1.1.1): Bug fixes, backwards compatible

Examples:
- `v1.0.0` - Initial release
- `v1.1.0` - Added new features
- `v1.1.1` - Fixed bugs
- `v2.0.0` - Major rewrite or breaking changes

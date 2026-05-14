# X Media Gallery Userscript

A userscript for X (Twitter) that builds a media gallery by intercepting background network data.

## Description

This script adds a "Media Gallery" button to X.com. As you browse your timeline, bookmarks, or search results, the script quietly captures images and videos from the background network traffic and displays them in a grid. Because it uses the data X is already loading, it avoids making extra API calls and prevents rate limit issues.

Features:
- Extracts images, videos, and GIFs directly from the timeline data.
- Includes a full-screen lightbox viewer with keyboard navigation.
- Allows fetching more media by automatically grabbing the next page of results.
- Works across all major browsers.

## Installation

1. Install a userscript manager extension for your browser (e.g., [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)).
2. Open the `userscript.js` file in this repository.
3. Click the **Raw** button to view the raw code. Your userscript manager will automatically prompt you to install it.
4. Go to [x.com](https://x.com) to use the script.

## Usage

- Click the **Media Gallery** button in the bottom right corner of the page.
- Click any image in the grid to open the full-screen viewer.
- Use the arrow keys to navigate the viewer, and the Esc key to close it.
- Use the "Skip To" input to automatically load a specific number of media items.

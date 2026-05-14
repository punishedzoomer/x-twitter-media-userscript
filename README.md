# X Network Intercept Media Gallery

A high-performance, native-styled Userscript for X (formerly Twitter) that intercepts background GraphQL data to build a seamless media gallery without triggering API rate limits.

## 🌟 Features

*   **Silent Data Interception**: Hooks directly into X's `fetch` and `XMLHttpRequest` APIs to quietly extract media from your timeline, bookmarks, or search results exactly as you browse.
*   **Zero Extra API Calls**: By capturing the data X is already loading, the script avoids aggressive rate limits or requiring separate authentication.
*   **Automated Pagination & Fast Forward**: Need more media? The built-in "Fast Forward" tool can automatically hit GraphQL cursors in the background to instantly load hundreds of media items without manual scrolling.
*   **Sleek Lightbox Viewer**: Clicking any media opens a custom, high-resolution lightbox viewer complete with keyboard navigation (Arrow keys, Escape).
*   **Video & GIF Support**: Fully supports capturing and playing native `video/mp4` variants and animated GIFs.
*   **Bulletproof Layout**: Utilizes a robust Flexbox layout to ensure the gallery grid looks perfect across all browsers, including strict versions of Firefox.
*   **Native Aesthetics**: The UI is designed to perfectly blend in with X's modern aesthetic using native fonts, colors, and SVGs.

## 🚀 Installation

1. Install a Userscript manager extension for your browser (e.g., [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)).
2. Open the `userscript.js` file in this repository.
3. Copy the contents or click the **Raw** button. Your Userscript manager should automatically prompt you to install it.
4. Go to [x.com](https://x.com) or [twitter.com](https://twitter.com) and start scrolling!

## 🛠️ How it Works

The script operates at `document-start` to ensure it wraps the browser's native `window.fetch` before X's JavaScript bundles load. As X makes requests to its `/graphql/` endpoints (like `Timeline`, `Search`, or `Bookmarks`), the script clones the JSON responses and deeply searches for `extended_entities`. 

Any found media is instantly cached in a `Map()` and rendered into a hidden DOM popup. It also cleverly captures the necessary authentication headers and pagination `cursor` tokens, allowing the script's "Fetch More" tools to simulate authentic GraphQL requests to quietly load more timeline history.

## 💻 Usage

- **Opening the Gallery**: Click the floating **Media Gallery** button in the bottom right corner of X.
- **Viewing Full Size**: Click any square in the grid to open the Lightbox Viewer.
- **Navigation**: Use the `←` and `→` arrow keys to navigate the Lightbox, and `Esc` to close it.
- **Original Context**: Inside the Lightbox, click the **View Original Tweet ↗** button to jump straight to the source tweet.
- **Loading More**: Use the "Skip To" input to enter a target number of media items, and the script will automatically background-fetch until it hits that number.

# Billboard 200 Chart Explorer

A web application that allows you to search and explore Billboard 200 chart data from 1967 to the present.

## Features

- **Search by multiple criteria**: Find chart entries by artist, album, chart date, or peak position.
- **Advanced filtering**: Use exact match option to narrow down results.
- **Comprehensive statistics**: View detailed stats about search results including:
  - Total chart appearances
  - Best chart position
  - Longest chart run
  - Number of unique entries
  - Top albums with their performance metrics
  - First and last chart appearances with a visual timeline

## Data Source

This application uses data from the [utdata/rwd-billboard-data](https://github.com/utdata/rwd-billboard-data) GitHub repository, which contains Billboard chart data going back to the chart's inception. The data is regularly updated via GitHub Actions.

## How to Use

1. **Select a search type**:
   - Artist: Search for all chart entries by a specific artist
   - Album: Search for a specific album title
   - Chart Date: Find chart entries within a specific date range
   - Peak Position: Find all entries that reached a specific peak position

2. **Enter your search term** or select a date range if searching by chart date.

3. **Optionally check "Exact match"** to find only exact matches rather than partial matches.

4. **Click "Search"** to see the results.

5. **View statistics** that automatically appear for your search results.

6. **Reset** to start a new search.

## Installation

This application can be run in two ways:

### Client-side Only

This is the simplest option and requires no installation. Simply open `index.html` in a modern web browser.

#### Running Locally with a Simple HTTP Server

1. Install [Node.js](https://nodejs.org/) if you don't have it already.
2. Use a simple HTTP server, for example:
   ```
   npx serve
   ```
3. Open the provided URL in your browser (usually http://localhost:3000).

### Server-side with API

The application also includes a Node.js server implementation that provides API endpoints for the Billboard data. This is useful if you want to integrate the data with other applications or need server-side processing.

#### Setup

1. Install [Node.js](https://nodejs.org/) if you don't have it already.
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open http://localhost:3000 in your browser.

#### API Endpoints

The server provides the following API endpoints:

- **GET /api/billboard** - Get all Billboard 200 data
- **GET /api/billboard/artist/:artist** - Search by artist name
  - Optional query parameter: `exact=true` for exact matches
- **GET /api/billboard/album/:title** - Search by album title
  - Optional query parameter: `exact=true` for exact matches
- **GET /api/billboard/date** - Search by date range
  - Required query parameters: `start` and `end` (format: YYYY-MM-DD)
- **GET /api/billboard/position/:position** - Search by peak position

Examples:
- `/api/billboard/artist/beatles?exact=true` - Find all chart entries by exactly "beatles"
- `/api/billboard/album/thriller` - Find all chart entries containing "thriller" in the title
- `/api/billboard/date?start=2020-01-01&end=2020-12-31` - Find all chart entries from 2020
- `/api/billboard/position/1` - Find all #1 albums

## Development

For development with automatic server restarts:

```
npm run dev
```

## Known Issues

- The Chart data from the source repository may have minor data errors as noted in their documentation.
- Some older charts (especially from 1967) may have incomplete data.

## License

This project is released under the MIT License, matching the license of the data source repository. 
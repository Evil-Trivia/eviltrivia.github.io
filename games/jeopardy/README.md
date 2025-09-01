# Jeopardy Dataset Automation for EvilTrivia.com

This directory contains automated tools for fetching and maintaining the latest Jeopardy dataset from the [Jeopardy Clue Dataset](https://github.com/jwolle1/jeopardy_clue_dataset) repository.

## 🎯 What This Does

- **Automatically fetches** the latest `combined_season_*.tsv` file from GitHub
- **Converts** TSV files to clean UTF-8 JSON
- **Normalizes** special characters (smart quotes, em dashes, etc.)
- **Runs monthly** via cron job to keep data fresh
- **Creates backups** of previous datasets
- **Logs all activity** for monitoring and debugging

## 📁 File Structure

```
games/jeopardy/
├── fetch-jeopardy-data.js    # Main data fetcher script
├── install-cron.js           # Cron job installer
├── split-dataset.js          # Dataset chunking utility
├── setup-dataset.js          # First-time setup script
├── package.json              # Node.js dependencies
├── README.md                 # This file
└── data/                    # Generated data directory
    ├── jeopardy_clues_latest.json    # Latest dataset (generated)
    ├── chunks/                       # Dataset chunks for git storage
    │   ├── chunk_000.json           # 50K clues (0-49,999)
    │   ├── chunk_001.json           # 50K clues (50K-99,999)
    │   └── ...                      # 11 total chunks
    ├── dataset-metadata.json        # Chunk metadata
    ├── backups/                      # Historical backups
    ├── fetch_log.json               # Activity logs
    ├── last_update.json             # Last update metadata
    └── cron.log                     # Cron execution logs
```

## 🔪 Dataset Chunking System

The large dataset (178MB) is automatically split into 11 manageable chunks (50K clues each) for git storage:

- **Chunks**: Stored in git (each <100MB)
- **Full Dataset**: Automatically reassembled when needed
- **Setup**: Run `npm run setup` after cloning to reassemble
- **Updates**: Automatic chunking after each fetch

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd games/jeopardy
npm install
```

### 2. Setup Dataset (First Time Only)

```bash
npm run setup
```

This will automatically reassemble the dataset from the stored chunks.

### 3. Test the Fetcher

```bash
npm test
```

### 4. Run Manual Fetch

```bash
npm run fetch
```

### 5. Install Monthly Cron Job

```bash
npm run install-cron
```

## ⚙️ Configuration

The system automatically:
- Fetches from: `https://github.com/jwolle1/jeopardy_clue_dataset`
- Updates: Monthly on the 1st at 2:00 AM
- Output: `jeopardy_clues_latest.json`
- Backups: Keeps last 5 versions
- Logs: Maintains last 100 entries

## 📊 Output Format

The generated JSON file contains:

```json
{
  "metadata": {
    "source": "https://github.com/jwolle1/jeopardy_clue_dataset",
    "originalFile": "combined_season_40_2023-2024_cleaned.tsv",
    "lastModified": "2024-01-15T10:30:00Z",
    "processedAt": "2024-01-15T15:45:00Z",
    "totalClues": 12345
  },
  "clues": [
    {
      "show_number": "1234",
      "air_date": "2001-01-01",
      "round": "Jeopardy!",
      "category": "HISTORY",
      "value": "$200",
      "question": "What is...",
      "answer": "The correct answer"
    }
    // ... more clues
  ]
}
```

## 🔧 Manual Operations

### Fetch Latest Data

```bash
node fetch-jeopardy-data.js
```

### Install Cron Job

```bash
node install-cron.js install
```

### Remove Cron Job

```bash
node install-cron.js remove
```

### View Help

```bash
node install-cron.js help
```

### Split Dataset into Chunks

```bash
npm run split
```

### Reassemble Dataset from Chunks

```bash
npm run reassemble
```

### Setup Dataset (First Time)

```bash
npm run setup
```

## 📝 Logging

All operations are logged to:
- **Console**: Real-time output during execution
- **`fetch_log.json`**: Structured logs with timestamps
- **`cron.log`**: Cron job execution logs (if using cron)

## 🛠️ Troubleshooting

### Common Issues

1. **Permission Denied**: Make sure the script is executable
   ```bash
   chmod +x fetch-jeopardy-data.js
   ```

2. **Cron Job Not Running**: Check if cron is enabled
   ```bash
   sudo launchctl load -w /System/Library/LaunchDaemons/com.vix.cron.plist
   ```

3. **GitHub API Limits**: The script uses the public GitHub API with rate limiting

4. **Encoding Issues**: The script handles UTF-16 to UTF-8 conversion automatically

### Debug Mode

Run with verbose logging:
```bash
DEBUG=1 node fetch-jeopardy-data.js
```

### Check Status

View last update info:
```bash
cat data/last_update.json
```

View recent logs:
```bash
cat data/fetch_log.json | tail -20
```

## 🔄 Integration with EvilTrivia

The generated `jeopardy_clues_latest.json` file can be used by:

- **Frontend games**: Load clues for Jeopardy-style gameplay
- **Admin tools**: Manage and curate question sets
- **APIs**: Serve clues to external applications
- **Analytics**: Track question performance and difficulty

## 📅 Maintenance

- **Automatic**: Monthly updates via cron
- **Manual**: Run `npm run fetch` anytime
- **Backups**: Automatically managed (last 5 versions)
- **Logs**: Automatically rotated (last 100 entries)

## 🚨 Error Handling

The system handles:
- Network failures (retries on next run)
- Invalid TSV data (logs errors, continues processing)
- File system issues (creates directories, handles permissions)
- GitHub API changes (graceful degradation)

## 📞 Support

For issues or questions:
1. Check the logs in `data/fetch_log.json`
2. Verify cron job is installed: `crontab -l`
3. Test manual execution: `npm run fetch`
4. Check file permissions and Node.js version

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Maintainer**: EvilTrivia Team

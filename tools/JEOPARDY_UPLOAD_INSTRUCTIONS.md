# Jeopardy Data Upload Instructions

This document provides instructions for uploading the Jeopardy archive data to Firebase for the Jeopardy Studying Tool.

## Prerequisites

1. Firebase Admin SDK credentials (Service Account Key)
2. Node.js and npm installed
3. Jeopardy archive TSV file

## Setup

1. Install dependencies:
   ```
   cd tools
   npm install
   ```

2. Place your Firebase Admin SDK credentials file in `config/firebase-admin-key.json`

## Upload Instructions

The current version of the upload script (`jeopardy-upload.js`) uses the Firebase Web SDK, which requires authentication to write data to Firebase. To properly upload the data, you'll need to modify the script to use the Firebase Admin SDK:

1. Update the script to use the Admin SDK:
   ```javascript
   const admin = require('firebase-admin');
   const serviceAccount = require('../config/firebase-admin-key.json');

   admin.initializeApp({
     credential: admin.credential.cert(serviceAccount),
     databaseURL: 'https://eviltrivia-47664-default-rtdb.firebaseio.com'
   });

   const db = admin.database();
   ```

2. Update the database references to use the Admin SDK syntax:
   ```javascript
   // Example:
   await db.ref('tools/jeopardy/categories').set(categories);
   ```

3. Run the script:
   ```
   node jeopardy-upload.js "/path/to/jeopardy_archive.tsv"
   ```

## Troubleshooting

- **Permission Denied**: Ensure you have the correct service account key with proper permissions to write to the database.
- **Invalid Keys**: Firebase doesn't allow certain characters in keys. The script handles this by using arrays and indices.
- **Memory Issues**: The Jeopardy dataset is large; the script processes it in batches to avoid memory issues.

## Data Structure

The Jeopardy data is stored in Firebase with the following structure:

```
tools/
  jeopardy/
    metadata/
      totalQuestions: 242760
      totalCategories: 40209
      lastUpdated: "2025-03-26T18:47:25.926Z"
      totalBatches: 243
    categories/ [Array of all category names]
    categoryIndex/ [Object mapping category IDs to question indices]
    questions/
      batch0/ [Array of question objects]
      batch1/ [Array of question objects]
      ...
```

Each question object contains:
- `round`: The Jeopardy round (1, 2, or 3 for Final Jeopardy)
- `clue_value`: The dollar value of the clue
- `daily_double_value`: Value if it's a Daily Double
- `originalCategory`: The original category name
- `categoryId`: The index of the category in the categories array
- `comments`: Additional comments
- `answer`: The answer to the clue
- `question`: The clue text
- `air_date`: Original air date
- `notes`: Additional notes 
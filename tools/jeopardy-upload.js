const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, push } = require('firebase/database');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBruAY3SH0eO000LrYqwcOGXNaUuznoMkc",
  authDomain: "eviltrivia-47664.firebaseapp.com",
  databaseURL: "https://eviltrivia-47664-default-rtdb.firebaseio.com",
  projectId: "eviltrivia-47664",
  storageBucket: "eviltrivia-47664.firebasestorage.app",
  messagingSenderId: "401826818140",
  appId: "1:401826818140:web:c1df0bf4c602cc48231e99",
  measurementId: "G-2W6RK96Y34"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Path to the Jeopardy TSV file
const tsvFilePath = process.argv[2]; // Pass the file path as a command-line argument

if (!tsvFilePath) {
  console.error('Error: Please provide the path to the TSV file as a command-line argument.');
  process.exit(1);
}

// Function to process the TSV file
async function processTsvFile() {
  console.log(`Processing TSV file: ${tsvFilePath}`);
  
  const jeopardyData = [];
  const categoriesSet = new Set();
  
  // Create a readable stream from the TSV file
  fs.createReadStream(tsvFilePath)
    .pipe(csv({
      separator: '\t',
      headers: ['round', 'clue_value', 'daily_double_value', 'category', 'comments', 'answer', 'question', 'air_date', 'notes'],
      skipLines: 1
    }))
    .on('data', (row) => {
      // Parse the clue value as a number
      row.clue_value = parseInt(row.clue_value, 10) || 0;
      row.daily_double_value = parseInt(row.daily_double_value, 10) || 0;
      
      // Clean up air_date format if needed
      if (row.air_date) {
        row.air_date = row.air_date.trim();
      }
      
      // Track categories
      if (row.category) {
        categoriesSet.add(row.category);
      }

      // Add the row to the jeopardyData array
      jeopardyData.push(row);
    })
    .on('end', async () => {
      console.log(`Processed ${jeopardyData.length} Jeopardy questions.`);
      
      // Convert Set to Array for easier handling
      const categories = Array.from(categoriesSet);
      console.log(`Found ${categories.length} unique categories.`);
      
      try {
        // Upload data to Firebase in batches to avoid hitting limits
        const batchSize = 1000;
        const batches = [];
        
        for (let i = 0; i < jeopardyData.length; i += batchSize) {
          batches.push(jeopardyData.slice(i, i + batchSize));
        }
        
        console.log(`Uploading data to Firebase in ${batches.length} batches...`);
        
        // Upload categories list
        await set(ref(db, 'tools/jeopardy/categories'), categories);
        console.log('Categories list uploaded successfully.');
        
        // Create category-to-index map for reference
        const categoryMap = {};
        categories.forEach((category, index) => {
          categoryMap[category] = index;
        });
        
        // Create an index by category for faster filtering
        const categoryIndex = {};
        categories.forEach((category, categoryId) => {
          categoryIndex[categoryId] = [];
        });
        
        jeopardyData.forEach((item, index) => {
          if (item.category && categoryMap[item.category] !== undefined) {
            const categoryId = categoryMap[item.category];
            categoryIndex[categoryId].push(index);
          }
        });
        
        // Upload the category index
        await set(ref(db, 'tools/jeopardy/categoryIndex'), categoryIndex);
        console.log('Category index uploaded successfully.');
        
        // Then, upload each batch
        for (let i = 0; i < batches.length; i++) {
          // Deep clone the batch to avoid modifying the original data
          const processedBatch = JSON.parse(JSON.stringify(batches[i]));
          
          // Replace category names with indices in each batch
          processedBatch.forEach(item => {
            if (item.category && categoryMap[item.category] !== undefined) {
              item.originalCategory = item.category;
              item.categoryId = categoryMap[item.category];
            }
          });
          
          await set(ref(db, `tools/jeopardy/questions/batch${i}`), processedBatch);
          console.log(`Batch ${i + 1} of ${batches.length} uploaded successfully.`);
        }
        
        // Set metadata
        await set(ref(db, 'tools/jeopardy/metadata'), {
          totalQuestions: jeopardyData.length,
          totalCategories: categories.length,
          lastUpdated: new Date().toISOString(),
          totalBatches: batches.length
        });
        
        console.log('All Jeopardy data uploaded to Firebase successfully!');
        process.exit(0);
      } catch (error) {
        console.error('Error uploading to Firebase:', error);
        process.exit(1);
      }
    })
    .on('error', (error) => {
      console.error('Error processing TSV file:', error);
      process.exit(1);
    });
}

// Run the process
processTsvFile(); 
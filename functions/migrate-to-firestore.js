const admin = require('firebase-admin');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.database(); // Realtime Database
const firestore = admin.firestore(); // Firestore

async function migrateToolsToFirestore() {
    console.log('🚀 Starting migration from Realtime Database to Firestore...');
    console.log('📝 This will COPY data (not delete from Realtime Database)');
    
    try {
        // Get all tools data from Realtime Database
        console.log('📥 Fetching tools data from Realtime Database...');
        const toolsSnapshot = await db.ref('tools').once('value');
        const toolsData = toolsSnapshot.val();
        
        if (!toolsData) {
            console.log('❌ No tools data found in Realtime Database');
            return;
        }
        
        const fileNames = Object.keys(toolsData);
        console.log(`📂 Found ${fileNames.length} files: ${fileNames.join(', ')}`);
        
        let totalTerms = 0;
        let processedFiles = 0;
        
        // Process each file
        for (const fileName of fileNames) {
            console.log(`\n🔄 Processing file: ${fileName}`);
            const fileData = toolsData[fileName];
            
            if (!fileData || typeof fileData !== 'object') {
                console.log(`⚠️  Skipping ${fileName} - invalid data`);
                continue;
            }
            
            const batch = firestore.batch();
            let batchCount = 0;
            let fileTermCount = 0;
            
            // Process each score level
            for (const score in fileData) {
                const scoreNum = parseInt(score, 10);
                if (isNaN(scoreNum)) {
                    console.log(`⚠️  Skipping invalid score: ${score}`);
                    continue;
                }
                
                const scoreData = fileData[score];
                if (!scoreData || typeof scoreData !== 'object') continue;
                
                // Process each term in this score level
                for (const termId in scoreData) {
                    const termData = scoreData[termId];
                    if (!termData || !termData.term) continue;
                    
                    // Create document for Firestore
                    const docData = {
                        term: termData.term,
                        termLower: termData.term.toLowerCase(), // For case-insensitive search
                        parentheses: termData.parentheses || '',
                        score: scoreNum,
                        file: fileName,
                        originalTermId: termId,
                        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
                        // Add search-friendly fields
                        termLength: termData.term.length,
                        firstLetter: termData.term.charAt(0).toLowerCase(),
                        lastLetter: termData.term.charAt(termData.term.length - 1).toLowerCase()
                    };
                    
                    // Create unique document ID
                    const docId = `${fileName}_${score}_${termId}`;
                    const docRef = firestore.collection('tools').doc(docId);
                    
                    batch.set(docRef, docData);
                    batchCount++;
                    fileTermCount++;
                    totalTerms++;
                    
                    // Firestore batch limit is 500 operations
                    if (batchCount >= 450) {
                        console.log(`  💾 Committing batch of ${batchCount} terms...`);
                        await batch.commit();
                        
                        // Create new batch
                        const newBatch = firestore.batch();
                        Object.setPrototypeOf(batch, Object.getPrototypeOf(newBatch));
                        Object.assign(batch, newBatch);
                        batchCount = 0;
                        
                        // Small delay to avoid overwhelming Firestore
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }
            
            // Commit remaining items in batch
            if (batchCount > 0) {
                console.log(`  💾 Committing final batch of ${batchCount} terms...`);
                await batch.commit();
            }
            
            console.log(`✅ Completed ${fileName}: ${fileTermCount} terms migrated`);
            processedFiles++;
        }
        
        // Create a summary document
        const summaryDoc = {
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            totalTerms: totalTerms,
            filesProcessed: processedFiles,
            fileNames: fileNames,
            migrationSource: 'realtime-database-tools',
            version: '1.0'
        };
        
        await firestore.collection('migration-info').doc('tools-migration').set(summaryDoc);
        
        console.log('\n🎉 Migration completed successfully!');
        console.log(`📊 Summary:`);
        console.log(`   - Files processed: ${processedFiles}`);
        console.log(`   - Total terms migrated: ${totalTerms.toLocaleString()}`);
        console.log(`   - Firestore collection: 'tools'`);
        console.log(`   - Original data in Realtime Database: PRESERVED`);
        
        return {
            success: true,
            totalTerms,
            filesProcessed,
            fileNames
        };
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Export for use in Cloud Functions or direct execution
module.exports = { migrateToolsToFirestore };

// Allow direct execution
if (require.main === module) {
    migrateToolsToFirestore()
        .then((result) => {
            console.log('\n✅ Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration script failed:', error);
            process.exit(1);
        });
}

const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase admin with database URL
admin.initializeApp({
  databaseURL: 'https://eviltrivia-47664-default-rtdb.firebaseio.com'
});

/**
 * Migrates Patreon data from patreonUsers branch to users branch
 */
async function migratePatreonData() {
  console.log('Starting Patreon data migration...');

  try {
    // Fetch all patreon users
    const patreonUsersSnapshot = await admin.database().ref('patreonUsers').once('value');
    const patreonUsers = patreonUsersSnapshot.val() || {};
    
    console.log(`Found ${Object.keys(patreonUsers).length} Patreon users to migrate`);
    
    // Process each Patreon user
    for (const [patreonId, patreonData] of Object.entries(patreonUsers)) {
      console.log(`Processing Patreon user: ${patreonId}`);
      
      // Skip if no Firebase UID associated with this Patreon account
      if (!patreonData.firebaseUid) {
        console.log(`No Firebase UID for Patreon user ${patreonId}, skipping`);
        continue;
      }
      
      const firebaseUid = patreonData.firebaseUid;
      
      // Prepare the Patreon data to add to user
      const patreonUserData = {
        patreon: {
          id: patreonId,
          isActiveMember: patreonData.isActiveMember || false,
          pledgeAmountCents: patreonData.pledgeAmountCents || 0,
          pledgeAmountDollars: patreonData.pledgeAmountDollars || '0.00',
          patronStatus: patreonData.patronStatus || 'former_patron',
          email: patreonData.email,
          fullName: patreonData.fullName,
          imageUrl: patreonData.imageUrl,
          lastUpdated: patreonData.lastUpdated || admin.database.ServerValue.TIMESTAMP,
          // Store tokens securely for future API calls
          tokens: patreonData.tokens || null
        },
        // Update additional user fields if they don't exist
        patronStatus: patreonData.isActiveMember ? 'active' : 'inactive',
        patreonPledgeAmount: patreonData.pledgeAmountDollars || '0.00'
      };
      
      // Update user roles
      try {
        const userSnapshot = await admin.database().ref(`users/${firebaseUid}`).once('value');
        const userData = userSnapshot.val() || {};
        
        let roles = [];
        if (userData.roles && Array.isArray(userData.roles)) {
          roles = [...userData.roles]; // Clone existing roles
        } else if (userData.role && typeof userData.role === 'string') {
          roles = [userData.role]; // Convert single role to array
        }
        
        // Add 'patron' role if user is active patron and doesn't already have it
        if (patreonData.isActiveMember && !roles.includes('patron')) {
          roles.push('patron');
        }
        
        // Set roles and main role
        patreonUserData.roles = roles;
        patreonUserData.role = roles[0] || 'member'; // Set primary role
      } catch (rolesError) {
        console.error(`Error handling roles for user ${firebaseUid}:`, rolesError);
      }
      
      // Update the user data
      try {
        await admin.database().ref(`users/${firebaseUid}`).update(patreonUserData);
        console.log(`Successfully updated user ${firebaseUid} with Patreon data`);
      } catch (updateError) {
        console.error(`Error updating user ${firebaseUid}:`, updateError);
      }
    }
    
    console.log('Migration completed successfully!');
    console.log('NOTE: Original patreonUsers data has NOT been deleted. Delete manually after verification.');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Terminate the app
    process.exit();
  }
}

// Run migration
migratePatreonData(); 
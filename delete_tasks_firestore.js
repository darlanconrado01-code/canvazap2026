
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
// Collections to delete
const COLLECTIONS = [
    'tasks',
    'task_categories',
    'task_series',
    'task_attachments',
    'task_comments'
];

async function deleteCollection(db, collectionPath, batchSize) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        // When there are no documents left, we are done
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

async function main() {
    // Check for service account key
    // You can set GOOGLE_APPLICATION_CREDENTIALS env var OR put serviceAccountKey.json in this directory
    let serviceAccount;

    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'serviceAccountKey.json');

    if (fs.existsSync(keyPath)) {
        console.log(`Using service account key from: ${keyPath}`);
        serviceAccount = require(keyPath);
    } else {
        // Try environment variables if Vercel-like structure (optional, but good for local dev if set)
        if (process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL) {
            console.log("Using environment variables for credentials.");
            serviceAccount = {
                projectId: process.env.VITE_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
                privateKey: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
            };
        } else {
            console.error('ERROR: Could not find serviceAccountKey.json or GOOGLE_APPLICATION_CREDENTIALS.');
            console.error('Please download your service account key from Firebase Console -> Project Settings -> Service Accounts');
            console.error('And save it as "serviceAccountKey.json" in this directory.');
            process.exit(1);
        }
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    const db = admin.firestore();

    console.log("Starting deletion of Task module collections...");

    for (const col of COLLECTIONS) {
        console.log(`Deleting collection: ${col}...`);
        try {
            await deleteCollection(db, col, 100);
            console.log(`Successfully deleted collection: ${col}`);
        } catch (e) {
            console.error(`Error deleting ${col}:`, e);
        }
    }

    console.log("Deletion complete.");
}

main();

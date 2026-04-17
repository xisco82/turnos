import admin from 'firebase-admin';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const db = admin.firestore();
// Use default database, or init with specific database context if needed
export const adminAuth = admin.auth();

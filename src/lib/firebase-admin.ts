import { App, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const clientEmail =
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
  process.env.FIREBASE_CLIENT_EMAIL;

const privateKeyEnv =
  process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
  process.env.FIREBASE_PRIVATE_KEY;

const privateKey = privateKeyEnv
  ? privateKeyEnv.replace(/\\n/g, "\n")
  : undefined;

let app: App;

if (!getApps().length) {
  if (projectId && clientEmail && privateKey) {
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      databaseURL:
        process.env.FIREBASE_ADMIN_DATABASE_URL ||
        process.env.FIREBASE_DATABASE_URL ||
        process.env.WS_URL_FIREBASE ||
        process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
  } else {
    const databaseURL =
      process.env.FIREBASE_ADMIN_DATABASE_URL ||
      process.env.FIREBASE_DATABASE_URL ||
      process.env.WS_URL_FIREBASE ||
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

    if (databaseURL || projectId) {
      // Usa credenciales por defecto del entorno (gcloud login, etc.) pero
      // forzando la databaseURL y, si existe, el projectId del .env existente.
      app = initializeApp({
        projectId,
        databaseURL,
      });
    } else {
      // Último fallback: dejar que el SDK resuelva todo por defecto.
      app = initializeApp();
    }
  }
} else {
  app = getApp();
}

export const adminAuth = getAuth(app);
export const adminDb = getDatabase(app);
export const adminFirestore = getFirestore(app);
export const adminMessaging = getMessaging(app);

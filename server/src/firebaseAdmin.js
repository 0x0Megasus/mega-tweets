import admin from "firebase-admin";

const requiredEnv = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_DATABASE_URL",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

function normalizePrivateKey(rawValue) {
  const value = String(rawValue || "").replace(/\\n/g, "\n").trim();
  if (!value.includes("BEGIN PRIVATE KEY") || !value.includes("END PRIVATE KEY")) {
    throw new Error("FIREBASE_PRIVATE_KEY appears malformed");
  }
  return value;
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export const auth = admin.auth();
export const db = admin.database();

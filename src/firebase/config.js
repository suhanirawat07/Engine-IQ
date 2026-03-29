import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const requiredFirebaseKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

const missingFirebaseKeys = requiredFirebaseKeys.filter(
  (key) => !firebaseConfig[key]
);

export const firebaseConfigStatus = {
  isConfigured: missingFirebaseKeys.length === 0,
  missingKeys: missingFirebaseKeys,
};

if (!firebaseConfigStatus.isConfigured) {
  console.error(
    "Missing Firebase environment variables:",
    missingFirebaseKeys.map((key) => `REACT_APP_FIREBASE_${key.replace(/([A-Z])/g, "_$1").toUpperCase().replace(/^_/, "")}`)
  );
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;

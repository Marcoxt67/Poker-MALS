import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "insecure-dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(","),
  defaultUserChips: Number(process.env.DEFAULT_USER_CHIPS ?? 1000),

  // Firebase web config. These values are NOT secrets — the web config is meant
  // to be public and identifies the project, not the caller. Access control for
  // a Firebase project comes from the Firestore security rules, not from hiding
  // these. See the security note in the README.
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY ?? "AIzaSyBjCzzw9bI2LT-wjtZAYuM-0HaiqFqh7MA",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? "poker-326a4.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID ?? "poker-326a4",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? "poker-326a4.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? "184822227116",
    appId: process.env.FIREBASE_APP_ID ?? "1:184822227116:web:624df4eac1c4cb1e9ebf09",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID ?? "G-3CTD5HG9L1",
    // The Realtime Database URL is NOT part of the web config snippet shown for
    // Analytics — it must match the region the database was created in. The
    // default below is the us-central1 pattern; databases created in other
    // regions look like https://<project>-default-rtdb.<region>.firebasedatabase.app
    databaseURL: process.env.FIREBASE_DATABASE_URL ?? "https://poker-326a4-default-rtdb.firebaseio.com",
  },

  // When set (e.g. "127.0.0.1:9000"), the server talks to a local Realtime
  // Database emulator instead of the real project. Used by the test suite.
  databaseEmulatorHost: process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? "",
};

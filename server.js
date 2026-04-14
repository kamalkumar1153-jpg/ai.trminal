const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ai-pro-terminal-default-rtdb.firebaseio.com"
});

const db = admin.database();
const ref = db.ref("market_data");




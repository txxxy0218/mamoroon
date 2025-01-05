import * as admin from 'firebase-admin';
import * as fs from "fs";
import * as path from "path";

// Firebase 初期化
const serviceAccount = require("../secret/secret-key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Firestoreドキュメントの型定義
interface FirestoreData {
  [key: string]: {
    [key: string]: any;
  };
}

// 現在のディレクトリからの相対パスを絶対パスに変換
const dataPath = path.join(__dirname, '..', 'data');

fs.readdir(dataPath, async function (err: NodeJS.ErrnoException | null, files: string[]) {
  if (err) {
    console.error("Error reading directory:", err);
    return;
  }

  // JSONファイルのみをフィルタリング
  const jsonFiles = files.filter(file => file.endsWith('.json'));

  for (const file of jsonFiles) {
    const filePath = path.join(dataPath, file);
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(jsonData) as FirestoreData;
    
    // データをバッチ処理で書き込み
    const batch = db.batch();
    
    // コレクション内のドキュメントを処理
    for (const [collectionName, documents] of Object.entries(data)) {
      for (const [documentId, documentData] of Object.entries(documents)) {
        const docRef = db.collection(collectionName).doc(documentId);
        batch.set(docRef, documentData, { merge: true });
      }
    }
    
    await batch.commit();
    console.log(`${file} imported successfully!`);
  }
});
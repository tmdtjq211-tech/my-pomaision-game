import { initializeApp, getApps } from "firebase/app"
import { getDatabase } from "firebase/database"

const firebaseConfig = {
  apiKey: "AIzaSyDn-CkjlWu9N00Sxhr3E5R7K2Y4m-smX0k",
  authDomain: "boreagame758.firebaseapp.com",
  projectId: "boreagame758",
  storageBucket: "boreagame758.firebasestorage.app",
  messagingSenderId: "175596773890",
  appId: "1:175596773890:web:9ec8bf1cd69ec07fe43d1b",
  measurementId: "G-H595YQKJBM",
  databaseURL: "https://boreagame758-default-rtdb.firebaseio.com",
}

// Firebase 앱 초기화 (싱글톤)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const database = getDatabase(app)

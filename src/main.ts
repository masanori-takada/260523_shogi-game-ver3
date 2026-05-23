import './ui/styles.css'
import { initApp } from './ui/app.js'

// ------------------------------------------------------------
// アプリケーションエントリーポイント
// ------------------------------------------------------------

const root = document.getElementById('app')
if (!root) throw new Error('#app element not found')

initApp(root)

const fs = require('fs')
const path = require('path')

const uploadDir = path.join(process.cwd(), 'public', 'uploads')

// 确保上传目录存在
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
  console.log('Created uploads directory:', uploadDir)
} else {
  console.log('Uploads directory already exists:', uploadDir)
} 
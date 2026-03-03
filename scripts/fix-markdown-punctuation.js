#!/usr/bin/env node

/**
 * 修复 Markdown 文件中的加粗标记和标点符号位置
 * 将 **内容**。 改为 **内容。**
 */

const fs = require('fs');
const path = require('path');

// 配置
const TARGET_FILE = path.join(__dirname, '../public/terms.md');

function fixMarkdownPunctuation(content) {
  // 正则匹配：**内容。** 或 **内容.**
  // 将句号移到加粗符号外部
  // 匹配 ** 之间的内容，且内容以句号结尾
  const regex = /\*\*((?:(?!\*\*).)*?)([。.])\*\*/gs;
  
  // 替换：将句号移到 ** 外面
  const fixed = content.replace(regex, '**$1**$2');
  
  return fixed;
}

function main() {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(TARGET_FILE)) {
      console.error(`❌ 文件不存在: ${TARGET_FILE}`);
      process.exit(1);
    }

    console.log(`📖 读取文件: ${TARGET_FILE}`);
    
    // 读取文件内容
    const content = fs.readFileSync(TARGET_FILE, 'utf-8');
    
    console.log(`🔧 执行正则替换...`);
    
    // 执行替换
    const fixedContent = fixMarkdownPunctuation(content);
    
    // 统计替换次数
    const matches = content.match(/\*\*((?:(?!\*\*).)*?)([。.])\*\*/gs);
    const matchCount = matches ? matches.length : 0;
    
    if (matchCount === 0) {
      console.log(`✅ 没有找到需要修复的内容`);
      return;
    }
    
    // 写回文件
    fs.writeFileSync(TARGET_FILE, fixedContent, 'utf-8');
    
    console.log(`✅ 完成！共修复 ${matchCount} 处`);
    console.log(`📝 文件已更新: ${TARGET_FILE}`);
    
  } catch (error) {
    console.error(`❌ 错误:`, error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { fixMarkdownPunctuation };

/**
 * 违禁词过滤工具
 * 用于在图生图模式下过滤提示词中的违禁词
 */

// 默认违禁词列表（主要用于本地测试，生产环境请使用数据库管理）
const DEFAULT_PROFANITY_WORDS: string[] = [];

/**
 * 将违禁词替换为星号
 * @param text 需要过滤的文本
 * @param words 违禁词列表，如果不提供则使用默认列表
 * @returns 过滤后的文本
 */
export function filterProfanity(
  text: string,
  words: string[] = DEFAULT_PROFANITY_WORDS
): string {
  if (!text || words.length === 0) {
    return text;
  }

  let filteredText = text;

  // 对每个违禁词进行替换
  words.forEach((word) => {
    if (!word || word.trim() === '') {
      return;
    }

    const escapedWord = escapeRegExp(word);
    
    // 判断是否为中文（包含中文字符）
    const isChinese = /[\u4e00-\u9fa5]/.test(word);
    
    // 对于中文，不使用单词边界；对于英文，使用单词边界
    const regex = isChinese
      ? new RegExp(escapedWord, 'gi')
      : new RegExp(`\\b${escapedWord}\\b`, 'gi');
    
    // 将违禁词替换为相同长度的星号
    filteredText = filteredText.replace(regex, (match) => {
      return '*'.repeat(match.length);
    });
  });

  return filteredText;
}

/**
 * 转义正则表达式特殊字符
 * @param str 需要转义的字符串
 * @returns 转义后的字符串
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 检查文本是否包含违禁词
 * @param text 需要检查的文本
 * @param words 违禁词列表，如果不提供则使用默认列表
 * @returns 如果包含违禁词返回 true，否则返回 false
 */
export function containsProfanity(
  text: string,
  words: string[] = DEFAULT_PROFANITY_WORDS
): boolean {
  if (!text || words.length === 0) {
    return false;
  }

  return words.some((word) => {
    if (!word || word.trim() === '') {
      return false;
    }
    
    const escapedWord = escapeRegExp(word);
    
    // 判断是否为中文（包含中文字符）
    const isChinese = /[\u4e00-\u9fa5]/.test(word);
    
    // 对于中文，不使用单词边界；对于英文，使用单词边界
    const regex = isChinese
      ? new RegExp(escapedWord, 'i')
      : new RegExp(`\\b${escapedWord}\\b`, 'i');
    
    return regex.test(text);
  });
}


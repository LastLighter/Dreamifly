import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

/**
 * 为图片添加水印
 * @param imageBase64 base64格式的图片字符串（包含data:image/png;base64,前缀）
 * @param watermarkText 水印文本，默认为"Dreamifly"
 * @returns 添加水印后的base64图片字符串
 */
// 加载字体文件并转换为 base64（缓存结果）
let fontBase64Cache: string | null = null

function getFontBase64(): string {
  if (fontBase64Cache) {
    return fontBase64Cache
  }
  
  try {
    // 尝试读取字体文件（支持多种可能的路径）
    const fontPaths = [
      path.join(process.cwd(), 'fonts', 'Arial.ttf'),
      path.join(process.cwd(), 'fonts', 'arial.ttf'),
      path.join(process.cwd(), 'public', 'fonts', 'Arial.ttf'),
    ]
    
    for (const fontPath of fontPaths) {
      if (fs.existsSync(fontPath)) {
        const fontBuffer = fs.readFileSync(fontPath)
        fontBase64Cache = fontBuffer.toString('base64')
        return fontBase64Cache
      }
    }
  } catch (error) {
    console.warn('无法加载字体文件，将使用系统默认字体:', error)
  }
  
  return ''
}

export async function addWatermark(
  imageBase64: string,
  watermarkText: string = 'Dreamifly'
): Promise<string> {
  try {
    // 移除data URL前缀，获取纯base64数据
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64

    // 将base64转换为Buffer
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // 获取图片尺寸
    const metadata = await sharp(imageBuffer).metadata()
    const width = metadata.width || 1024
    const height = metadata.height || 1024

    // 计算水印字体大小（根据图片尺寸动态调整）
    const fontSize = Math.max(20, Math.min(width, height) / 30)
    
    // 转义SVG文本中的特殊字符
    const escapeXml = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    }
    
    const escapedText = escapeXml(watermarkText)
    
    // 估算文本宽度和高度（粗略估算）
    const textWidth = fontSize * watermarkText.length * 0.55
    const textHeight = fontSize * 0.6
    
    // 矩形框的内边距
    const padding = fontSize * 0.5
    const boxWidth = textWidth + padding * 2
    const boxHeight = textHeight + padding * 2
    
    // 左上角位置（留一些边距）
    const margin = Math.max(10, Math.min(width, height) / 50)
    const boxX = margin
    const boxY = margin
    
    // 圆角半径
    const borderRadius = fontSize * 0.3
    
    // 文本在矩形框内的位置（居中）
    // 使用 text-anchor="middle" 和 dominant-baseline="central" 时，坐标应该是矩形框的中心点
    const textX = boxX + boxWidth / 2
    const textY = boxY + boxHeight / 2+padding*0.8
    
    
    // 边框颜色与文字颜色一致
    const borderColor = "rgba(255, 255, 255, 0.9)"
    // 边框宽度（根据字体大小调整）
    const strokeWidth = Math.max(1, fontSize / 20)
    
    // 获取字体 base64（如果可用）
    const fontBase64 = getFontBase64()
    const fontFace = fontBase64 
      ? `<defs>
          <style>
            @font-face {
              font-family: 'Arial';
              src: url('data:font/truetype;charset=utf-8;base64,${fontBase64}') format('truetype');
              font-weight: bold;
              font-style: normal;
            }
          </style>
        </defs>`
      : ''
    
    // 创建SVG水印（包含圆角矩形边框和文本）
    const svgText = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        ${fontFace}
        <!-- 圆角矩形边框（中间镂空） -->
        <rect
          x="${boxX}"
          y="${boxY}"
          width="${boxWidth}"
          height="${boxHeight}"
          rx="${borderRadius}"
          ry="${borderRadius}"
          fill="none"
          stroke="${borderColor}"
          stroke-width="${strokeWidth}"
        />
        <!-- 文本 -->
        <text
          x="${textX}"
          y="${textY}"
          font-family="${fontBase64 ? 'Arial' : 'Arial, sans-serif'}"
          font-size="${fontSize}"
          font-weight="bold"
          fill="${borderColor}"
          text-anchor="middle"
          dominant-baseline="central"
          alignment-baseline="central"
        >${escapedText}</text>
      </svg>
    `

    // 将SVG转换为Buffer
    const svgBuffer = Buffer.from(svgText)

    // 合成水印
    const watermarkedImage = await sharp(imageBuffer)
      .composite([
        {
          input: svgBuffer,
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer()

    // 转换为base64
    const watermarkedBase64 = watermarkedImage.toString('base64')
    
    // 返回完整的data URL
    return `data:image/png;base64,${watermarkedBase64}`
  } catch (error) {
    console.error('添加水印失败:', error)
    // 如果添加水印失败，返回原图片
    return imageBase64
  }
}


import { Resend } from 'resend';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  try {
    // 只在请求时创建Resend实例，避免构建阶段使用环境变量
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Dreamifly <noreply@dreamifly.com>',
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('Error sending email:', error);
      // 保留原始错误信息，特别是配额限制等关键信息
      const errorMessage = error.message || 'Failed to send email';
      // 使用类型断言处理 error.name，因为 Resend 的错误类型可能不包含所有可能的错误名称
      const errorName = (error.name as string) || '';
      const statusCode = (error as any).statusCode || 0;
      
      // 精确检测配额限制错误：
      // 1. 错误名称是 daily_quota_exceeded
      // 2. 错误消息明确提到配额限制（daily email sending quota 或 You have reached your daily email sending quota）
      // 3. 状态码是 429（Too Many Requests）
      const isQuotaError = 
        errorName === 'daily_quota_exceeded' ||
        statusCode === 429 ||
        (errorMessage.toLowerCase().includes('daily email sending quota') ||
         errorMessage.toLowerCase().includes('you have reached your daily email sending quota') ||
         errorMessage.toLowerCase().includes('daily sending quota limit'));
      
      // 如果是配额限制错误，抛出包含配额信息的错误
      if (isQuotaError) {
        throw new Error(`邮件发送失败：已达每日限制验证人数上限。${errorMessage}`);
      }
      
      throw new Error(`邮件发送失败：${errorMessage}`);
    }

    console.log('Email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in sendEmail:', error);
    throw error;
  }
}

// 邮箱验证邮件模板
export function createVerificationEmailHTML(verificationUrl: string, userName: string) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>验证你的邮箱</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Dreamifly</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">AI 创意绘画平台</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: 600;">验证你的邮箱</h2>
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                你好 <strong>${userName}</strong>，
              </p>
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                感谢你注册 Dreamifly！请点击下面的按钮验证你的邮箱地址，完成注册流程。
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${verificationUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);">
                      验证邮箱
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                如果按钮无法点击，请复制以下链接到浏览器中打开：
              </p>
              <p style="margin: 10px 0 0 0; padding: 12px; background-color: #f3f4f6; border-radius: 6px; color: #4b5563; font-size: 13px; word-break: break-all;">
                ${verificationUrl}
              </p>
              
              <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  <strong>注意：</strong>此验证链接将在 24 小时后失效。
                </p>
                <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  如果你没有注册 Dreamifly 账号，请忽略此邮件。
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px;">
                © 2024 Dreamifly. All rights reserved.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                这是一封自动发送的邮件，请勿回复。
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// 密码重置邮件模板
export function createPasswordResetEmailHTML(resetUrl: string, userName: string) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>重置你的密码</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Dreamifly</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">AI 创意绘画平台</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: 600;">重置你的密码</h2>
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                你好 <strong>${userName}</strong>，
              </p>
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                我们收到了重置你 Dreamifly 账户密码的请求。点击下面的按钮设置新密码。
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);">
                      重置密码
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                如果按钮无法点击，请复制以下链接到浏览器中打开：
              </p>
              <p style="margin: 10px 0 0 0; padding: 12px; background-color: #f3f4f6; border-radius: 6px; color: #4b5563; font-size: 13px; word-break: break-all;">
                ${resetUrl}
              </p>
              
              <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 10px 0; color: #dc2626; font-size: 13px; line-height: 1.6;">
                  <strong>安全提示：</strong>此重置链接将在 1 小时后失效。
                </p>
                <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  如果你没有请求重置密码，请忽略此邮件，你的账户仍然是安全的。
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px;">
                © 2024 Dreamifly. All rights reserved.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                这是一封自动发送的邮件，请勿回复。
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}


import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { sendEmail, createVerificationEmailHTML, createPasswordResetEmailHTML } from "./email";
import { isEmailDomainAllowed, isValid163Email } from "@/utils/email-domain-validator";

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || "https://dreamifly.com",
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // 启用邮箱验证要求
    autoSignIn: false, // 注册后不自动登录，需要先验证邮箱
    beforeSignUp: async ({ user }: { user: { email: string; [key: string]: any } }) => {
      // 验证邮箱域名
      if (!user.email) {
        throw new Error("邮箱地址不能为空");
      }
      
      // 特殊验证163邮箱：只允许纯数字+@163.com
      if (!isValid163Email(user.email)) {
        throw new Error("163_EMAIL_NOT_ALLOWED");
      }
      
      const isAllowed = await isEmailDomainAllowed(user.email);

      if (!isAllowed) {
        throw new Error("不支持该邮箱类型注册");
      }
      
      return user;
    },
    sendResetPassword: async ({ user, url }) => {
      // 输出重置链接到控制台（方便开发调试）
      console.log('\n' + '='.repeat(80));
      console.log('🔐 密码重置邮件');
      console.log('收件人:', user.email);
      console.log('重置链接:', url);
      console.log('提示: 如果QQ邮箱拦截localhost链接，请直接复制上面的链接到浏览器');
      console.log('='.repeat(80) + '\n');
      
      // 发送密码重置邮件
      await sendEmail({
        to: user.email,
        subject: "重置你的 Dreamifly 密码",
        html: createPasswordResetEmailHTML(url, user.name),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true, // 注册时自动发送验证邮件
    autoSignInAfterVerification: true, // 验证后自动登录
    sendVerificationEmail: async ({ user, url }) => {
      // 输出验证链接到控制台（方便开发调试）
      console.log('\n' + '='.repeat(80));
      console.log('📧 邮箱验证邮件');
      console.log('收件人:', user.email);
      console.log('验证链接:', url);
      console.log('提示: 如果QQ邮箱拦截localhost链接，请直接复制上面的链接到浏览器');
      console.log('='.repeat(80) + '\n');
      
      try {
        // 发送邮箱验证邮件
        await sendEmail({
          to: user.email,
          subject: "验证你的 Dreamifly 邮箱",
          html: createVerificationEmailHTML(url, user.name),
        });
      } catch (error: any) {
        // 捕获错误并检查是否是配额限制错误
        const errorMessage = (error?.message || '').toLowerCase();
        const isQuotaError = 
          errorMessage.includes('配额') ||
          errorMessage.includes('quota') ||
          errorMessage.includes('daily email sending quota') ||
          errorMessage.includes('已达到每日发送配额');
        
        // 如果是配额限制错误，抛出带有错误码的自定义错误
        if (isQuotaError) {
          const quotaError: any = new Error('邮件发送失败：已达每日限制验证人数上限');
          quotaError.code = 'daily_quota_exceeded';
          throw quotaError;
        }
        
        // 其他错误直接抛出
        throw error;
      }
    },
  },
  user: {
    additionalFields: {
      uid: {
        type: "number",
        required: false,
        unique: true,
        // uid 将在注册时自动生成（在注册路由中处理）
      },
      avatar: {
        type: "string",
        required: false,
        defaultValue: "/images/default-avatar.svg",
      },
      nickname: {
        type: "string",
        required: false,
        // 昵称将在注册时设置为用户输入的 name（在注册路由中处理）
      },
      signature: {
        type: "string",
        required: false,
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      lastLoginAt: {
        type: "date",
        required: false,
      },
      isAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      isPremium: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      isOldUser: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      dailyRequestCount: {
        type: "number",
        required: false,
        defaultValue: 0,
      },
      lastRequestResetDate: {
        type: "date",
        required: false,
      },
      avatarFrameId: {
        type: "number",
        required: false,
      },
      availableAvatarFrameIds: {
        type: "string",
        required: false,
      },
      acceptedDownloadTerms: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (update session every day)
    cookieCache: {
      enabled: false, // 禁用cookie缓存，强制每次都从服务器获取
    },
  },
});

export type Session = typeof auth.$Infer.Session;


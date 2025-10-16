import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { sendEmail, createVerificationEmailHTML, createPasswordResetEmailHTML } from "./email";

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || "https://dreamifly.com",
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // 启用邮箱验证要求
    autoSignIn: false, // 注册后不自动登录，需要先验证邮箱
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
      
      // 发送邮箱验证邮件
      await sendEmail({
        to: user.email,
        subject: "验证你的 Dreamifly 邮箱",
        html: createVerificationEmailHTML(url, user.name),
      });
    },
  },
  user: {
    additionalFields: {
      uid: {
        type: "number",
        required: false,
        unique: true,
        // uid 将在注册后通过 signup-handler API 自动生成
      },
      avatar: {
        type: "string",
        required: false,
        defaultValue: "/images/default-avatar.svg",
      },
      nickname: {
        type: "string",
        required: false,
        // 昵称将在注册后设置为 Dreamer-{uid}
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (update session every day)
  },
});

export type Session = typeof auth.$Infer.Session;


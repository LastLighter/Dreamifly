import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || "https://dreamifly.com",
  fetchOptions: {
    cache: 'no-store', // 禁用缓存
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    onSuccess: async (context) => {
      // 登录/注册成功后，强制刷新session
      if (context.response.ok) {
        // 等待服务器端session设置完成
        await new Promise(resolve => setTimeout(resolve, 200));
        // 强制刷新页面以确保session更新
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    },
  },
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  updateUser,
  changePassword,
  forgetPassword,
  resetPassword,
  sendVerificationEmail,
  $fetch,
} = authClient;


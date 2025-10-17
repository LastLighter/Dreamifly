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


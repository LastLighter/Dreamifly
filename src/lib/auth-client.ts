import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || "https://dreamifly.com",
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


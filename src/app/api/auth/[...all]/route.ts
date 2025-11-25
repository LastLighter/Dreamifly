import { auth } from "@/lib/auth";
import { isEmailDomainAllowed } from "@/utils/email-domain-validator";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

const handler = toNextJsHandler(auth);
const SIGNUP_EMAIL_PATH = "/api/auth/sign-up/email";

function jsonError(message: string, code?: string, status = 400) {
  // better-auth 客户端期望的错误格式是 { error: { message: string, code?: string } }
  return new NextResponse(JSON.stringify({ error: { message, ...(code && { code }) } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function ensureAllowedEmailDomain(request: NextRequest) {
  if (
    request.method !== "POST" ||
    request.nextUrl.pathname !== SIGNUP_EMAIL_PATH
  ) {
    return null;
  }

  let payload: { email?: string } = {};

  try {
    const bodyText = await request.clone().text();
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return jsonError("请求体无效，无法读取邮箱信息");
  }

  if (!payload.email) {
    return jsonError("邮箱地址不能为空");
  }

  const isAllowed = await isEmailDomainAllowed(payload.email);

  if (!isAllowed) {
    // 返回固定的错误标识，前端会根据错误码显示对应的翻译
    return jsonError("EMAIL_DOMAIN_NOT_ALLOWED", "EMAIL_DOMAIN_NOT_ALLOWED");
  }

  return null;
}

export const GET = async (request: NextRequest) => {
  return handler.GET(request);
};

export const POST = async (request: NextRequest) => {
  const validationResponse = await ensureAllowedEmailDomain(request);
  if (validationResponse) {
    return validationResponse;
  }

  return handler.POST(request);
};


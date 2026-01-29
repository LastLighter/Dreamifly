import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { createCDK, getCDKList, updateCDKExpiry, deleteCDK } from '@/utils/cdkManager';

export async function GET(request: Request) {
  try {
    // 验证管理员权限
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const packageType = searchParams.get('packageType') || undefined;
    const isRedeemed = searchParams.get('isRedeemed') === 'true' ? true :
                      searchParams.get('isRedeemed') === 'false' ? false : undefined;
    const code = searchParams.get('code') || undefined;

    const result = await getCDKList(page, pageSize, { packageType, isRedeemed, code });

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取CDK列表失败:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 验证管理员权限
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { packageType, packageId, expiresAt } = body;

    if (!packageType || !packageId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['points_package', 'subscription_plan'].includes(packageType)) {
      return NextResponse.json({ error: 'Invalid package type' }, { status: 400 });
    }

    const code = await createCDK({
      packageType,
      packageId: parseInt(packageId),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    }, session.user.id);

    return NextResponse.json({ code });
  } catch (error) {
    console.error('创建CDK失败:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    // 验证管理员权限
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, expiresAt } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing CDK ID' }, { status: 400 });
    }

    await updateCDKExpiry(id, expiresAt ? new Date(expiresAt) : undefined);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新CDK失败:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/cdk/route.ts:96',message:'DELETE handler called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  try {
    // 验证管理员权限
    const session = await auth.api.getSession({
      headers: await headers()
    });

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/cdk/route.ts:103',message:'Session check',data:{hasSession:!!session,isAdmin:session?.user?.isAdmin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/cdk/route.ts:110',message:'ID extracted from query',data:{id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (!id) {
      return NextResponse.json({ error: 'Missing CDK ID' }, { status: 400 });
    }

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/cdk/route.ts:114',message:'Calling deleteCDK',data:{id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    await deleteCDK(id);

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/cdk/route.ts:116',message:'deleteCDK completed successfully',data:{id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ success: true });
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/cdk/route.ts:119',message:'Delete error caught in API',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.error('删除CDK失败:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

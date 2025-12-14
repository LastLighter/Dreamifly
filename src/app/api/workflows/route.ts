import { NextResponse } from 'next/server'
import { ALL_WORKFLOWS, type WorkflowConfig } from '@/utils/workflowConfig'

// 工作流环境变量映射
const WORKFLOW_ENV_MAP = {
  "repair": "Supir_Repair_URL",
  "upscale": "Supir_Repair_URL", // 放大和修复使用同一个环境变量
} as const;

/**
 * 检查工作流是否在环境变量中配置了URL
 */
function isWorkflowConfigured(workflowId: string): boolean {
  const envVarName = WORKFLOW_ENV_MAP[workflowId as keyof typeof WORKFLOW_ENV_MAP];
  if (!envVarName) {
    return false;
  }
  
  const envValue = process.env[envVarName];
  return Boolean(envValue && envValue.trim() !== '');
}

/**
 * 获取可用的工作流列表（基于环境变量配置）
 */
function getAvailableWorkflows(): WorkflowConfig[] {
  return ALL_WORKFLOWS.filter(workflow => {
    // 检查是否配置了环境变量
    return isWorkflowConfigured(workflow.id);
  });
}

export async function GET() {
  try {
    const availableWorkflows = getAvailableWorkflows();
    
    return NextResponse.json({
      workflows: availableWorkflows,
      total: availableWorkflows.length
    });
  } catch (error) {
    console.error('Error fetching available workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available workflows' },
      { status: 500 }
    );
  }
}


import { NextResponse } from 'next/server'

// 工作流环境变量映射
const WORKFLOW_ENV_MAP = {
  "repair": "Supir_Repair_URL",
  "upscale": "Supir_Repair_URL", // 放大和修复使用同一个环境变量
} as const;

// 基础工作流配置
interface WorkflowConfig {
  id: string;
  name: string;
  description?: string;
  homepageCover?: string;
  tags?: string[];
  route?: string;
}

// 完整的工作流配置列表
const ALL_WORKFLOWS: WorkflowConfig[] = [
  {
    id: "repair",
    name: "图片修复",
    description: "使用先进的AI技术修复图片中的瑕疵、划痕和缺陷，恢复图片的原始质量。支持自动识别并修复各种图像问题，让您的照片焕然一新。",
    homepageCover: "/workflows/homepageWorkflowCover/demo.jpg",
    tags: ["图片修复", "图像增强"],
    route: "/workflows"
  },
  {
    id: "upscale",
    name: "图片放大",
    description: "通过AI超分辨率技术提升图片分辨率和清晰度，放大图片的同时保持细节和画质。支持自定义放大倍数，让低分辨率图片变成高清大图。",
    homepageCover: "/workflows/homepageWorkflowCover/demo.jpg",
    tags: ["图片放大", "超分辨率"],
    route: "/workflows"
  }
];

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


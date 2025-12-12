// 工作流配置管理工具

export interface WorkflowConfig {
  id: string;
  name: string;
  description?: string;
  homepageCover?: string; // 主页竖屏封面，默认为 /workflows/homepageWorkflowCover/demo.jpg
  tags?: string[];
  route?: string; // 路由路径，默认为 /workflows
}

// 完整的工作流配置列表
export const ALL_WORKFLOWS: WorkflowConfig[] = [
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
 * 从API获取可用的工作流列表（基于环境变量配置）
 * @returns Promise<WorkflowConfig[]> 可用的工作流配置列表
 */
export async function getAvailableWorkflows(): Promise<WorkflowConfig[]> {
  try {
    const response = await fetch('/api/workflows');
    if (!response.ok) {
      throw new Error('Failed to fetch available workflows');
    }
    
    const data = await response.json();
    return data.workflows || [];
  } catch (error) {
    console.error('Error fetching available workflows:', error);
    // 如果API调用失败，返回空数组
    return [];
  }
}

/**
 * 获取所有工作流配置（不检查环境变量）
 * @returns 所有工作流配置列表
 */
export function getAllWorkflows(): WorkflowConfig[] {
  return ALL_WORKFLOWS;
}

/**
 * 根据ID获取工作流配置
 * @param workflowId 工作流ID
 * @returns 工作流配置，如果不存在则返回 null
 */
export function getWorkflowById(workflowId: string): WorkflowConfig | null {
  return ALL_WORKFLOWS.find(w => w.id === workflowId) || null;
}


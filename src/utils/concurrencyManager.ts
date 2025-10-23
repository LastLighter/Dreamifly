// 并发请求管理器 - 用于限制已登录用户的并发生图请求

interface ActiveGeneration {
  id: string;
  userId: string;
  startTime: number;
}

// 使用 Map 存储活跃的生成请求
const activeGenerations = new Map<string, ActiveGeneration>();

// 定期清理超时的请求（10分钟无响应视为超时）
const TIMEOUT_MS = 10 * 60 * 1000; // 10分钟
const CLEANUP_INTERVAL_MS = 60 * 1000; // 每分钟清理一次

setInterval(() => {
  const timeoutThreshold = Date.now() - TIMEOUT_MS;
  for (const [id, gen] of activeGenerations.entries()) {
    if (gen.startTime < timeoutThreshold) {
      console.log(`[ConcurrencyManager] 清理超时请求: ${id} (用户: ${gen.userId})`);
      activeGenerations.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS);

export const concurrencyManager = {
  /**
   * 检查用户是否可以开始新的生成请求
   * @param userId 用户ID
   * @param maxConcurrent 最大并发数（默认从环境变量读取）
   * @returns 是否可以开始新请求
   */
  canStart(userId: string, maxConcurrent?: number): boolean {
    const limit = maxConcurrent ?? parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '2', 10);
    const userGenerations = Array.from(activeGenerations.values())
      .filter(gen => gen.userId === userId);
    return userGenerations.length < limit;
  },
  
  /**
   * 获取用户当前的并发请求数
   * @param userId 用户ID
   * @returns 当前并发数
   */
  getCurrentCount(userId: string): number {
    return Array.from(activeGenerations.values())
      .filter(gen => gen.userId === userId).length;
  },
  
  /**
   * 开始一个新的生成请求
   * @param userId 用户ID
   * @returns 生成请求ID
   */
  start(userId: string): string {
    const id = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    activeGenerations.set(id, {
      id,
      userId,
      startTime: Date.now(),
    });
    console.log(`[ConcurrencyManager] 开始请求: ${id} (用户: ${userId}, 当前并发: ${this.getCurrentCount(userId)})`);
    return id;
  },
  
  /**
   * 结束一个生成请求
   * @param id 生成请求ID
   */
  end(id: string): void {
    const gen = activeGenerations.get(id);
    if (gen) {
      const duration = ((Date.now() - gen.startTime) / 1000).toFixed(1);
      console.log(`[ConcurrencyManager] 结束请求: ${id} (用户: ${gen.userId}, 耗时: ${duration}s, 剩余并发: ${this.getCurrentCount(gen.userId) - 1})`);
      activeGenerations.delete(id);
    }
  },
  
  /**
   * 获取统计信息（用于调试和监控）
   */
  getStats() {
    const byUser: Record<string, number> = {};
    for (const gen of activeGenerations.values()) {
      byUser[gen.userId] = (byUser[gen.userId] || 0) + 1;
    }
    
    return {
      total: activeGenerations.size,
      byUser,
      activeRequests: Array.from(activeGenerations.values()).map(gen => ({
        id: gen.id,
        userId: gen.userId,
        elapsedSeconds: ((Date.now() - gen.startTime) / 1000).toFixed(1)
      }))
    };
  },
  
  /**
   * 清理特定用户的所有请求（用于用户登出等场景）
   * @param userId 用户ID
   */
  clearUser(userId: string): void {
    for (const [id, gen] of activeGenerations.entries()) {
      if (gen.userId === userId) {
        activeGenerations.delete(id);
      }
    }
    console.log(`[ConcurrencyManager] 清理用户所有请求: ${userId}`);
  }
};


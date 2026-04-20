// ALADIN Zalo Bot — Worker Health & Stats API
// GET /api/zalo/worker — Worker health check and queue statistics
// POST /api/zalo/worker/restart — Restart the worker (emergency use)
// GET /api/zalo/worker/dlq — View dead-letter queue messages

import { NextRequest, NextResponse } from 'next/server';
import { getWorkerStats, startWorker, stopWorker } from '@/lib/zalo/worker';
import { messageQueue } from '@/lib/zalo/message-queue';

// ============================================
// GET /api/zalo/worker — Health Check & Stats
// ============================================

export async function GET() {
  const stats = getWorkerStats();

  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: string;
    queue: typeof stats;
    alerts: string[];
  } = {
    status: 'healthy',
    uptime: formatUptime(stats.uptimeSeconds),
    queue: stats,
    alerts: [],
  };

  // Determine health status
  if (!stats.workerRunning) {
    health.status = 'unhealthy';
    health.alerts.push('Worker is not running');
  }

  if (stats.deadLetter > 10) {
    health.status = 'degraded';
    health.alerts.push(`${stats.deadLetter} messages in dead-letter queue`);
  }

  if (stats.queued > 500) {
    health.status = 'degraded';
    health.alerts.push(`${stats.queued} messages queued (high backlog)`);
  }

  if (stats.avgProcessingTimeMs > 5000) {
    health.status = 'degraded';
    health.alerts.push(`Average processing time is ${stats.avgProcessingTimeMs}ms (slow)`);
  }

  return NextResponse.json(health);
}

// ============================================
// POST /api/zalo/worker — Worker Control
// ============================================

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = body.action as string | undefined;

  switch (action) {
    case 'restart':
      stopWorker();
      // Small delay before restarting
      await new Promise((resolve) => setTimeout(resolve, 500));
      startWorker();
      return NextResponse.json({ success: true, message: 'Worker restarted' });

    case 'stop':
      stopWorker();
      return NextResponse.json({ success: true, message: 'Worker stopped' });

    case 'start':
      startWorker();
      return NextResponse.json({ success: true, message: 'Worker started' });

    default:
      return NextResponse.json(
        { error: 'Invalid action. Use: start, stop, restart' },
        { status: 400 }
      );
  }
}

// ============================================
// DLQ SUBROUTE — handled in dlq/route.ts
// ============================================

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

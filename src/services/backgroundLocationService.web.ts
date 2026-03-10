export interface BackgroundLocationConfig {
  autoProcessOnForeground: boolean;
  maxQueueSize: number;
  processingInterval: number;
  minAccuracy: number;
  minDistance: number;
}

export interface BackgroundLocationStats {
  totalProcessed: number;
  totalFailed: number;
  lastProcessedAt: number;
  queueSize: number;
  isProcessing: boolean;
}

export class BackgroundLocationService {
  private static instance: BackgroundLocationService;
  private config: BackgroundLocationConfig;
  private stats: BackgroundLocationStats;

  private constructor() {
    this.config = {
      autoProcessOnForeground: true,
      maxQueueSize: 500,
      processingInterval: 60000,
      minAccuracy: 200,
      minDistance: 50,
    };

    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      lastProcessedAt: 0,
      queueSize: 0,
      isProcessing: false,
    };
  }

  public static getInstance(): BackgroundLocationService {
    if (!BackgroundLocationService.instance) {
      BackgroundLocationService.instance = new BackgroundLocationService();
    }
    return BackgroundLocationService.instance;
  }

  public configure(config: Partial<BackgroundLocationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public async start(): Promise<boolean> {
    console.warn('Background location is not supported on web.');
    return true;
  }

  public async stop(): Promise<void> {
    return;
  }

  public async processQueuedLocations(): Promise<{
    processed: number;
    failed: number;
    skipped: number;
  }> {
    return { processed: 0, failed: 0, skipped: 0 };
  }

  public async getStats(): Promise<BackgroundLocationStats> {
    return { ...this.stats };
  }

  public async forceProcess(): Promise<boolean> {
    return true;
  }
}

export const backgroundLocationService = BackgroundLocationService.getInstance();

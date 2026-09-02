import { Global, Inject, Injectable, Module, OnModuleDestroy, Optional } from "@nestjs/common";
import { Redis } from "ioredis";

export const REDIS = "REDIS";
export const REDIS_QUEUE = "REDIS_QUEUE";

@Injectable()
export class RedisShutdown implements OnModuleDestroy {
  constructor(
    @Optional() @Inject(REDIS) private readonly cache: Redis | null,
    @Optional() @Inject(REDIS_QUEUE) private readonly queue: Redis | null,
  ) {}
  async onModuleDestroy() {
    if (this.cache) await this.cache.quit().catch(() => undefined);
    if (this.queue) await this.queue.quit().catch(() => undefined);
  }
}

function connect(url: string, extras: { maxRetriesPerRequest: number | null }) {
  const client = new Redis(url, {
    maxRetriesPerRequest: extras.maxRetriesPerRequest,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  client.connect().catch(() => undefined);
  client.on("error", () => undefined);
  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: () => {
        const url = process.env.REDIS_URL;
        if (!url) return null;
        return connect(url, { maxRetriesPerRequest: 2 });
      },
    },
    {
      provide: REDIS_QUEUE,
      useFactory: () => {
        const url = process.env.REDIS_URL;
        if (!url) return null;
        return connect(url, { maxRetriesPerRequest: null });
      },
    },
    RedisShutdown,
  ],
  exports: [REDIS, REDIS_QUEUE],
})
export class RedisModule {}

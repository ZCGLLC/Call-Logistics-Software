import { Inject, Injectable, Optional } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS } from "../redis.module.js";
import { PrismaService } from "../prisma.service.js";

const DAY_TTL = 172800;

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function hourKey(d = new Date()): string {
  return d.toISOString().slice(0, 13);
}

@Injectable()
export class CapsService {
  private readonly memory = new Map<string, { value: number; exp: number }>();

  constructor(
    @Optional() @Inject(REDIS) private readonly redis: Redis | null,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  dailyBuyerKey(orgId: string, buyerId: string, day = dayKey()) {
    return `cap:${orgId}:buyer:${buyerId}:daily:${day}`;
  }
  hourlyBuyerKey(orgId: string, buyerId: string, hour = hourKey()) {
    return `cap:${orgId}:buyer:${buyerId}:hourly:${hour}`;
  }
  concurrentBuyerKey(orgId: string, buyerId: string) {
    return `cap:${orgId}:buyer:${buyerId}:concurrent`;
  }
  dailyCampaignKey(orgId: string, campaignId: string, day = dayKey()) {
    return `cap:${orgId}:campaign:${campaignId}:daily:${day}`;
  }

  async get(key: string): Promise<number> {
    if (this.redis) {
      try {
        const v = await this.redis.get(key);
        if (v != null) return Number(v);
      } catch {
        /* fall through to memory / db */
      }
    }
    const mem = this.memory.get(key);
    if (mem && mem.exp > Date.now()) return mem.value;
    return 0;
  }

  async hydrateDailyBuyer(orgId: string, buyerId: string): Promise<number> {
    const key = this.dailyBuyerKey(orgId, buyerId);
    const cached = await this.get(key);
    if (cached > 0) return cached;
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const count = await this.prisma.call.count({
      where: { organizationId: orgId, buyerId, startedAt: { gte: start }, status: { not: "FAILED" } },
    });
    await this.set(key, count, DAY_TTL);
    return count;
  }

  async hydrateDailyCampaign(orgId: string, campaignId: string): Promise<number> {
    const key = this.dailyCampaignKey(orgId, campaignId);
    const cached = await this.get(key);
    if (cached > 0) return cached;
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const count = await this.prisma.call.count({
      where: { organizationId: orgId, campaignId, startedAt: { gte: start }, status: { not: "FAILED" } },
    });
    await this.set(key, count, DAY_TTL);
    return count;
  }

  async incrementDaily(orgId: string, buyerId: string, campaignId: string) {
    await this.incr(this.dailyBuyerKey(orgId, buyerId), DAY_TTL);
    await this.incr(this.hourlyBuyerKey(orgId, buyerId), 7200);
    await this.incr(this.dailyCampaignKey(orgId, campaignId), DAY_TTL);
  }

  async enterConcurrent(orgId: string, buyerId: string): Promise<number> {
    return this.incr(this.concurrentBuyerKey(orgId, buyerId), 3600);
  }

  async leaveConcurrent(orgId: string, buyerId: string): Promise<number> {
    return this.decr(this.concurrentBuyerKey(orgId, buyerId));
  }

  async ping(): Promise<"up" | "down" | "disabled"> {
    if (!this.redis) return "disabled";
    try {
      const pong = await this.redis.ping();
      return pong === "PONG" ? "up" : "down";
    } catch {
      return "down";
    }
  }

  private async set(key: string, value: number, ttlSec: number) {
    this.memory.set(key, { value, exp: Date.now() + ttlSec * 1000 });
    if (!this.redis) return;
    try {
      await this.redis.set(key, String(value), "EX", ttlSec);
    } catch {
      /* memory remains */
    }
  }

  private async incr(key: string, ttlSec: number): Promise<number> {
    const mem = this.memory.get(key);
    const next = (mem && mem.exp > Date.now() ? mem.value : 0) + 1;
    this.memory.set(key, { value: next, exp: Date.now() + ttlSec * 1000 });
    if (this.redis) {
      try {
        const v = await this.redis.incr(key);
        await this.redis.expire(key, ttlSec);
        return v;
      } catch {
        return next;
      }
    }
    return next;
  }

  private async decr(key: string): Promise<number> {
    const mem = this.memory.get(key);
    const next = Math.max(0, (mem && mem.exp > Date.now() ? mem.value : 1) - 1);
    this.memory.set(key, { value: next, exp: Date.now() + 3600_000 });
    if (this.redis) {
      try {
        const v = await this.redis.decr(key);
        return Math.max(0, v);
      } catch {
        return next;
      }
    }
    return next;
  }
}

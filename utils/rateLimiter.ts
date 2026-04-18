import { redis } from "./redis";

type RateLimitorPayload = {
    key: string;
    limit: number;
    windowSeconds: number;
}

export const rateLimit = async ({ key, limit, windowSeconds }: RateLimitorPayload) => {
    const current = await redis.incr(key);

    if (current === 1) {
        // first request → set expiry
        await redis.expire(key, windowSeconds);
    }

    if (current > limit) {
        return false;
    }

    return true;
}


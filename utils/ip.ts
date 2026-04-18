
import { NextRequest } from "next/server";

export const getClientIp = (req: NextRequest) => {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const firstIp = forwardedFor.split(",")[0]?.trim();
        if (firstIp) return firstIp;
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp) {
        return realIp;
    }

    return "unknown";
};
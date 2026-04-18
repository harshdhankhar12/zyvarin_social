import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo";
import { redis } from "@/utils/redis";
import { rateLimit } from "@/utils/rateLimiter";
import { getClientIp } from "@/utils/ip";

export async function POST(req: NextRequest) {
    const session = await currentLoggedInUserInfo();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientIp = getClientIp(req);
    const userKey = `rl:create_team:user:${session.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 5, windowSeconds: 300 });

    if (!userAllowed) {
        return NextResponse.json(
            { error: `Too many team creation requests. Try again in ${await redis.ttl(userKey)} seconds.` },
            { status: 429 }
        );
    }

    const ipKey = `rl:create_team:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 15, windowSeconds: 300 });

    if (!ipAllowed) {
        return NextResponse.json(
            { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
            { status: 429 }
        );
    }

    const { name, description } = await req.json();

    try {
        if (!name || name.trim().length < 3) {
            return NextResponse.json({ error: "Team name must be at least 3 characters long" }, { status: 400 });
        }
        const team = await prisma.team.create({
            data: {
                name: name.trim(),
                description: description ? description.trim() : '',
                ownerId: session.id,
                slug: name.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000),
            }
        })

        await prisma.teamMember.create({
            data: {
                teamId: team.id,
                userId: session.id,
                role: 'OWNER',
                status: "ACCEPTED",
                invitedBy: session.id
            }
        })

        return NextResponse.json({ message: "Team created successfully", teamId: team.id }, { status: 201 });


    } catch (error) {
        console.error("Error creating team:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
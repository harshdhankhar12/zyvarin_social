import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo";
import { redis } from "@/utils/redis";
import { rateLimit } from "@/utils/rateLimiter";
import { getClientIp } from "@/utils/ip";

export async function POST(req: NextRequest) {
  const session = await currentLoggedInUserInfo();
  if (!session || typeof session === 'boolean') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIp = getClientIp(req);
  const userKey = `rl:accept_invite:user:${session.id}`;
  const userAllowed = await rateLimit({ key: userKey, limit: 10, windowSeconds: 300 });

  if (!userAllowed) {
    return NextResponse.json(
      { error: `Too many invite acceptance requests. Try again in ${await redis.ttl(userKey)} seconds.` },
      { status: 429 }
    );
  }

  const ipKey = `rl:accept_invite:ip:${clientIp}`;
  const ipAllowed = await rateLimit({ key: ipKey, limit: 25, windowSeconds: 300 });

  if (!ipAllowed) {
    return NextResponse.json(
      { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
      { status: 429 }
    );
  }

  try {
    const { token, action } = await req.json();

    if (!token || !action) {
      return NextResponse.json({ error: "Token and action required" }, { status: 400 });
    }

    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            max_members: true,
            _count: { select: { members: true } }
          }
        }
      }
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
    }

    if (invite.status !== 'PENDING') {
      return NextResponse.json({ error: "Invitation already processed" }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      await prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: 'PENDING' }
      });
      return NextResponse.json({ error: "Invitation expired" }, { status: 400 });
    }

    if (session.email !== invite.email) {
      return NextResponse.json({ error: "This invitation was sent to a different email" }, { status: 403 });
    }

    if (action === 'decline') {
      await prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: 'DECLINED' }
      });

      await prisma.teamAuditLog.create({
        data: {
          teamId: invite.teamId,
          userId: session.id,
          action: `Declined invitation`
        }
      });

      return NextResponse.json({ message: "Invitation declined" }, { status: 200 });
    }

    if (action === 'accept') {
      if (invite.team._count.members >= invite.team.max_members) {
        return NextResponse.json({ error: "Team has reached maximum member limit" }, { status: 400 });
      }

      const existingMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: invite.teamId,
            userId: session.id
          }
        }
      });

      if (existingMember) {
        return NextResponse.json({ error: "You are already a member of this team" }, { status: 400 });
      }

      await prisma.$transaction([
        prisma.teamMember.create({
          data: {
            teamId: invite.teamId,
            userId: session.id,
            role: invite.role,
            status: 'ACCEPTED',
            invitedBy: invite.invitedById
          }
        }),
        prisma.teamInvite.update({
          where: { id: invite.id },
          data: { status: 'ACCEPTED' }
        }),
        prisma.teamAuditLog.create({
          data: {
            teamId: invite.teamId,
            userId: session.id,
            action: `Joined team as ${invite.role}`,
            details: `Accepted invitation sent to ${invite.email}`

          }
        }),
        prisma.notification.create({
          data: {
            userId: invite.invitedById,
            type: 'TEAM',
            teamId: invite.teamId,
            senderType: 'SYSTEM',
            title: 'Team Invitation Accepted',
            message: `${session.fullName} accepted your invitation to join ${invite.team.name}`
          }
        })
      ]);

      return NextResponse.json({
        message: "Successfully joined team",
        teamSlug: invite.team.slug
      }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("Error processing invitation:", error);
    return NextResponse.json({ error: "Failed to process invitation" }, { status: 500 });
  }
}

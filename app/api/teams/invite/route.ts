import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo";
import { sendMail } from "@/utils/mail";
import { canManageMembers } from "@/utils/teamUtils";
import { redis } from "@/utils/redis";
import { rateLimit } from "@/utils/rateLimiter";
import { getClientIp } from "@/utils/ip";

export async function POST(req: NextRequest) {
  const session = await currentLoggedInUserInfo();
  if (!session || typeof session === 'boolean') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIp = getClientIp(req);
  const userKey = `rl:invite_member:user:${session.id}`;
  const userAllowed = await rateLimit({ key: userKey, limit: 10, windowSeconds: 300 });

  if (!userAllowed) {
    return NextResponse.json(
      { error: `Too many invite requests. Try again in ${await redis.ttl(userKey)} seconds.` },
      { status: 429 }
    );
  }

  const ipKey = `rl:invite_member:ip:${clientIp}`;
  const ipAllowed = await rateLimit({ key: ipKey, limit: 25, windowSeconds: 300 });

  if (!ipAllowed) {
    return NextResponse.json(
      { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
      { status: 429 }
    );
  }

  try {
    const { teamId, email, role } = await req.json();

    if (!teamId || !email || !role) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }

    const canManage = await canManageMembers(teamId, session.id);
    if (!canManage) {
      return NextResponse.json({ error: "Only team owner or admin can invite members" }, { status: 403 });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true, slug: true, max_members: true, _count: { select: { members: true } } }
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (team._count.members >= team.max_members) {
      return NextResponse.json({ error: "Team has reached maximum member limit" }, { status: 400 });
    }

    const invitedUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, fullName: true, email: true }
    });

    if (!invitedUser) {
      return NextResponse.json({ error: "User not found. They need to create a Zyvarin account first." }, { status: 404 });
    }

    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: invitedUser.id
        }
      }
    });

    if (existingMember) {
      return NextResponse.json({ error: "User is already a team member" }, { status: 400 });
    }

    const existingInvite = await prisma.teamInvite.findFirst({
      where: {
        teamId,
        email,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });

    if (existingInvite) {
      return NextResponse.json({ error: "Pending invitation already exists for this user" }, { status: 400 });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const invite = await prisma.teamInvite.create({
      data: {
        teamId,
        email,
        role,
        token,
        expiresAt,
        invitedById: session.id,
        status: 'PENDING'
      }
    });

    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId: session.id,
        action: `Invited ${email} as ${role}`
      }
    });

    const inviteLink = `${process.env.NEXTAUTH_URL}/invite/${token}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Team Invitation</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #f7f8fa;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <tr>
                        <td style="padding: 40px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding-bottom: 32px;">
                                        <img src="https://zyvarin.com/_next/image?url=%2Fzyvarin-logo_1.png&w=256&q=75" width="120" alt="Zyvarin" style="height: auto;">
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #111827;">You're invited to join ${team.name}</h1>
                                        <p style="margin: 0 0 24px; font-size: 16px; line-height: 26px; color: #4B5563;">
                                            ${session.fullName} has invited you to collaborate on ${team.name} on Zyvarin. You'll join as a ${role.toLowerCase()}.
                                        </p>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td align="center" style="padding: 32px 0;">
                                                    <a href="${inviteLink}" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                                        Accept Invitation
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <p style="margin: 24px 0 0; font-size: 14px; line-height: 24px; color: #6B7280; text-align: center;">
                                            This invitation will expire in <strong>30 minutes</strong>.<br>
                                            If you didn't expect this invitation, you can safely ignore this email.
                                        </p>
                                        <div style="margin-top: 32px; padding-top: 32px; border-top: 1px solid #E5E7EB;">
                                            <p style="margin: 0; font-size: 14px; color: #6B7280; text-align: center; line-height: 1.5;">
                                                <strong style="color: #111827;">The Zyvarin Team</strong>
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px; text-align: center; font-size: 12px; color: #9CA3AF;">
                            <p style="margin: 0 0 8px;">&copy; ${new Date().getFullYear()} Zyvarin Inc. All rights reserved.</p>
                            <p style="margin: 0;">
                                <a href="https://zyvarin.com/contact" style="color: #6B7280; text-decoration: underline;">Contact</a> &bull; 
                                <a href="https://zyvarin.com/legal/privacy-policy" style="color: #6B7280; text-decoration: underline;">Privacy</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    await sendMail({
      to: email,
      subject: `You're invited to join ${team.name} on Zyvarin`,
      htmlContent
    });

    await prisma.notification.create({
      data: {
        userId: invitedUser.id,
        type: 'TEAM',
        teamId,
        senderType: 'SYSTEM',
        title: 'Team Invitation',
        message: `You've been invited to join ${team.name} as ${role}`
      }
    });

    return NextResponse.json({
      message: "Invitation sent successfully",
      expiresAt: expiresAt.toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error("Error sending invitation:", error);
    return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 });
  }
}

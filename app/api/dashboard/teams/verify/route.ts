import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo";
import { sendMail } from "@/utils/mail";

type OtpRecord = {
    otp: string;
    expiry: Date;
    teamId: string;
};

const otpStore = new Map<string, OtpRecord>();




export async function POST(req: NextRequest) {
    const session = await currentLoggedInUserInfo();
    if (!session || typeof session === 'boolean') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.email;

    try {
        const { teamId } = await req.json();

        if (!teamId || teamId.trim().length === 0) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }

        const team = await prisma.team.findUnique({
            where: { id: teamId }
        });

        if (!team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        if (team.ownerId !== session.id) {
            return NextResponse.json({ error: "You are not the owner of this team" }, { status: 403 });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        otpStore.set(session.id, { otp, expiry, teamId });

        const subject = "Team Creation Verification";
        const to = userEmail;
        const htmlContent = `
        <!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="utf-8">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
    <!--[if mso]>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
    <style>
        td,th,div,p,a,h1,h2,h3,h4,h5,h6 {font-family: "Segoe UI", sans-serif; mso-line-height-rule: exactly;}
    </style>
    <![endif]-->
    <title>Verify Team Creation</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" media="screen">
    <style>
        .hover-text-brand:hover { color: #4F46E5 !important; }
        @media (max-width: 600px) {
            .sm-w-full { width: 100% !important; }
            .sm-px-6 { padding-left: 24px !important; padding-right: 24px !important; }
            .sm-py-8 { padding-top: 32px !important; padding-bottom: 32px !important; }
        }
    </style>
</head>
<body style="margin: 0; width: 100%; padding: 0; word-break: break-word; -webkit-font-smoothing: antialiased; background-color: #f7f8fa;">
    <div role="article" aria-roledescription="email" aria-label="Verify Team Creation" lang="en">
        <table style="width: 100%; font-family: 'Inter', sans-serif;" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
                <td align="center" style="background-color: #f7f8fa; padding-top: 40px; padding-bottom: 40px;">
                    <table class="sm-w-full" style="width: 600px;" cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                            <td align="center" class="sm-px-6" style="padding-bottom: 32px;">
                                <table style="width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
                                    <tr>
                                        <td align="center">
                                            <!-- Logo -->
                                            <a href="https://zyvarin.com" style="text-decoration: none;">
                                                <img src="https://zyvarin.com/_next/image?url=%2Fzyvarin-logo_1.png&w=256&q=75" width="120" alt="Zyvarin Logo" style="border: none; max-width: 100%; height: auto;">
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td class="sm-px-6">
                                <table style="width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
                                    <tr>
                                        <td style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); padding: 48px;">
                                            <h1 style="margin: 0; font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 700; color: #111827; text-align: center; letter-spacing: -0.025em;">
                                                Confirm Team Creation
                                            </h1>
                                            <p style="margin: 24px 0 32px; font-size: 16px; line-height: 26px; color: #4B5563; text-align: center;">
                                                You are creating the team <strong style="color: #111827;">"${team.name}"</strong> on Zyvarin. Please enter the verification code below to authorize this action.
                                            </p>
                                            
                                            <table style="width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
                                                <tr>
                                                    <td align="center" style="padding-bottom: 32px;">
                                                        <div style="background-color: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 12px; padding: 24px 40px; display: inline-block;">
                                                            <span style="font-family: 'Inter', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #4F46E5; line-height: 1; mso-line-height-rule: exactly;">
                                                                ${otp}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>

                                            <p style="margin: 0; font-size: 14px; line-height: 24px; color: #6B7280; text-align: center;">
                                                This code will expire in <strong>10 minutes</strong>. If you did not initiate this request, please change your password immediately.
                                            </p>

                                            <table style="width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
                                                <tr>
                                                    <td style="padding-top: 32px; border-bottom: 1px solid #E5E7EB;"></td>
                                                </tr>
                                            </table>

                                            <p style="margin: 32px 0 0; font-size: 14px; color: #6B7280; text-align: center; line-height: 1.5;">
                                                Securely,<br>
                                                <strong style="color: #111827;">The Zyvarin Security Team</strong>
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td class="sm-px-6" style="padding: 32px; text-align: center; font-size: 12px; color: #9CA3AF;">
                                <p style="margin: 0 0 8px;">&copy; ${new Date().getFullYear()} Zyvarin Inc. All rights reserved.</p>
                                <p style="margin-top: 12px;">
                                    <a href="https://zyvarin.com/contact" class="hover-text-brand" style="color: #6B7280; text-decoration: underline;">Unsubscribe</a> &bull; 
                                    <a href="https://zyvarin.com/legal/security-policy" class="hover-text-brand" style="color: #6B7280; text-decoration: underline;">Security Center</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>`

        await sendMail({ to, subject, htmlContent })
        return NextResponse.json({ message: "We have sent you an OTP to verify your Team Creation" }, { status: 200 });


    } catch (error) {
        console.error("Error sending team verification OTP:", error);
        return NextResponse.json({ error: "Error sending verification code" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const { otp } = await req.json();
        const session = await currentLoggedInUserInfo();
        if (!session || typeof session === 'boolean') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!otp) {
            return NextResponse.json({ error: "OTP is required" }, { status: 400 })
        }

        const record = otpStore.get(session.id);
        if (!record) {
            return NextResponse.json({ error: "No OTP found. Please request a new code." }, { status: 400 });
        }

        const { otp: storedOtp, expiry, teamId } = record;
        const currentTime = new Date();

        if (storedOtp !== otp) {
            return NextResponse.json({ error: "Your OTP is incorrect" }, { status: 400 });
        }

        if (currentTime > expiry) {
            otpStore.delete(session.id);
            return NextResponse.json({ error: "The OTP you entered has expired" }, { status: 400 });
        }

        const teamInfo = await prisma.team.findUnique({
            where: {
                id: teamId
            },
            select: {
                name: true,
                ownerId: true,
            }
        });

        if (!teamInfo) {
            otpStore.delete(session.id);
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        if (teamInfo.ownerId !== session.id) {
            return NextResponse.json({ error: "You are not the owner of this team" }, { status: 403 });
        }

        await prisma.team.update({
            where: {
                id: teamId,
                ownerId: session.id
            },
            data: {
                isVerified: true,
                status: "ACTIVE"
            }
        });

        await prisma.notification.create({
            data: {
                userId: session.id,
                senderType: "SYSTEM",
                title: "Team Creation Verified",
                message: `You have successfully verified your team "${teamInfo?.name}". You can now start adding members and managing your team settings.`,
                type: "TEAM"
            }
        })

        await prisma.teamAuditLog.create({
            data: {
                teamId: teamId,
                action: "TEAM_VERIFIED",
                userId: session.id,
                details: `Welcome to your new team "${teamInfo?.name}"! Your team has been successfully verified. You can now start adding members, assigning roles, and managing your team's social media accounts. Enjoy collaborating and growing together!`
            }
        })

        otpStore.delete(session.id);
        return NextResponse.json({ message: "Team creation verified successfully!" }, { status: 200 });

    } catch (error) {
        console.error("Error verifying OTP:", error);
        return NextResponse.json({ error: "Error verifying OTP" }, { status: 500 });

    }
}
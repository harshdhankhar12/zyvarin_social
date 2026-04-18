import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendMail } from "@/utils/mail";
import { redis } from "@/utils/redis";
import { rateLimit } from "@/utils/rateLimiter";
import { getClientIp } from "@/utils/ip";




export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();
        if (!email || email.trim() === '') {
            return NextResponse.json({ errror: "Email is Required" }, { status: 400 })
        }

        const normalizedEmail = String(email ?? "").trim().toLowerCase();

        const clientIp = getClientIp(req);
        const emailKey = `rl:otp:email:${normalizedEmail}`;
        const emailAllowed = await rateLimit({ key: emailKey, limit: 3, windowSeconds: 300 });

        if (!emailAllowed) {
            return NextResponse.json({ error: `Too many OTP requests for this email. Try after  ${await redis.ttl(emailKey)} seconds.` }, { status: 429 });
        }

        const ipKey = `rl:otp:ip:${clientIp}`;
        const ipAllowed = await rateLimit({ key: ipKey, limit: 10, windowSeconds: 300 });

        if (!ipAllowed) {
            return NextResponse.json({ error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` }, { status: 429 });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await redis.set(`otp:${normalizedEmail}`, otp, "EX", 10 * 60);


        const isEmailExists = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        })
        if (!isEmailExists) {
            return NextResponse.json({ error: "Email Not Exists. Use another Email." }, { status: 400 });
        }

        if (isEmailExists.isEmailVerified) {
            return NextResponse.json({ message: "Account Already Verified." }, { status: 201 })
        }



        const subject = "OTP For Account Verification - Zyvarin Social";
        const to = normalizedEmail;
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
    <title>Confirm Your Identity</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" media="screen">
    <style>
        .hover-bg-brand:hover { background-color: #4338ca !important; }
        .hover-text-brand:hover { color: #4F46E5 !important; }
        @media (max-width: 600px) {
            .sm-w-full { width: 100% !important; }
            .sm-px-6 { padding-left: 24px !important; padding-right: 24px !important; }
            .sm-py-8 { padding-top: 32px !important; padding-bottom: 32px !important; }
        }
    </style>
</head>
<body style="margin: 0; width: 100%; padding: 0; word-break: break-word; -webkit-font-smoothing: antialiased; background-color: #f7f8fa;">
    <div style="display: none;">
        Your Zyvarin verification code is: ${otp}. Use this to complete your registration.
        &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
        &#160;
    </div>
    <div role="article" aria-roledescription="email" aria-label="Confirm Your Identity" lang="en">
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
                                                <img src="https://zyvarin-social.vercel.app/zyvarin-logo.png" alt="Zyvarin Logo" width="120" style="border: none; display: block;">
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
                                                Confirm Your Identity
                                            </h1>
                                            <p style="margin: 24px 0; font-size: 16px; line-height: 26px; color: #4B5563; text-align: center;">
                                                Please use the verification code below to complete your registration and start using <strong>Zyvarin Social</strong>. This code is valid for <strong>10 minutes</strong>.
                                            </p>
                                            
                                            <!-- Verification Code Block -->
                                            <table style="width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
                                                <tr>
                                                    <td align="center" style="padding: 24px 0;">
                                                        <div style="background-color: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 12px; padding: 24px 40px; display: inline-block;">
                                                            <span style="font-family: 'Inter', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #4F46E5; line-height: 1;">
                                                                ${otp}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>

                                            <p style="margin: 0; font-size: 14px; line-height: 24px; color: #6B7280; text-align: center;">
                                                If you didn't create an account, you can safely ignore this email.
                                            </p>

                                            <table style="width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
                                                <tr>
                                                    <td style="padding-top: 32px; border-bottom: 1px solid #E5E7EB;"></td>
                                                </tr>
                                            </table>

                                            <p style="margin: 32px 0 0; font-size: 14px; color: #6B7280; text-align: center; line-height: 1.5;">
                                                Thanks,<br>
                                                <strong style="color: #111827;">The Zyvarin Team</strong>
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
                                    <a href="#" class="hover-text-brand" style="color: #6B7280; text-decoration: underline;">Unsubscribe</a> &bull; 
                                    <a href="#" class="hover-text-brand" style="color: #6B7280; text-decoration: underline;">Help Center</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
         `


        await sendMail({ to, subject, htmlContent })
        return NextResponse.json({ message: "We have sent you an OTP to verify your account" }, { status: 200 });

    } catch (error) {
        console.log(Error)
        return NextResponse.json({
            error: "Error sending email"
        }, { status: 404 })

    }
}


export async function PATCH(req: NextRequest) {
    try {
        const { email, otp } = await req.json();
        const normalizedEmail = String(email ?? "").trim().toLowerCase();
        const normalizedOtp = String(otp ?? "").trim();
        if (!normalizedEmail || !normalizedOtp) {
            return NextResponse.json({ error: "ALL Fields Required!" }, { status: 404 })
        }

        const storedOtp = await redis.get(`otp:${normalizedEmail}`);

        const clientIp = getClientIp(req);
        const emailKey = `rl:otp_verify:email:${normalizedEmail}`;
        const emailAllowed = await rateLimit({ key: emailKey, limit: 5, windowSeconds: 300 });
        if (!emailAllowed) {
            return NextResponse.json({ error: `Too many OTP verification attempts for this email. Try after ${await redis.ttl(emailKey)} seconds.` }, { status: 429 });
        }
        const ipKey = `rl:otp_verify:ip:${clientIp}`;
        const ipAllowed = await rateLimit({ key: ipKey, limit: 20, windowSeconds: 300 });
        if (!ipAllowed) {
            return NextResponse.json({ error: "Too many OTP verification attempts from this IP. Try after some time." }, { status: 429 });
        }
        if (!storedOtp) {
            return NextResponse.json({ error: "OTP Expired. Please Request a new one." }, { status: 400 });
        }

        if (storedOtp !== normalizedOtp) {
            return NextResponse.json({ error: "Invalid OTP. Please Try Again." }, { status: 400 });
        }
        await prisma.user.update({
            where: { email: normalizedEmail! },
            data: { isEmailVerified: true, status: "ACTIVE" }
        });

        await redis.del(`otp:${normalizedEmail}`);


        return NextResponse.json({ message: "Your email has been verified successfully. You can now log in." }, { status: 200 });


    } catch (error) {
        console.error("Error verifying OTP:", error);
        return NextResponse.json({ error: "Error verifying OTP" }, { status: 500 });

    }
}
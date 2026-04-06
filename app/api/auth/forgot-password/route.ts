import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendMail } from "@/utils/mail";
import bcrypt from "bcryptjs";

let otp = Math.floor(100000 + Math.random() * 900000).toString();
let otpExpiry = new Date(Date.now() + 10 * 60 * 1000);


let otpData = {
    otp,
    expiry: otpExpiry.toISOString(),
}


export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();
        if (!email || email.trim() === '') {
            return NextResponse.json({ errror: "Email is Required" }, { status: 400 })
        }

        const isEmailExists = await prisma.user.findUnique({
            where: { email }
        })
        if (!isEmailExists) {
            return NextResponse.json({ error: "Email Not Exists. Use another Email." }, { status: 400 });
        }

        const subject = "OTP For Reset Password - Zyvarin";
        const to = email;
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
    <title>OTP For Reset Password - Zyvarin</title>
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
        Your Zyvarin verification code is: ${otpData.otp}. Use this to reset your password.
        &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
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
                                                Reset Your Password
                                            </h1>
                                            <p style="margin: 24px 0; font-size: 16px; line-height: 26px; color: #4B5563; text-align: center;">
                                                Please use the verification code below to reset your password for <strong>Zyvarin Social</strong>. This code is valid for <strong>10 minutes</strong>.
                                            </p>
                                            
                                            <!-- Verification Code Block -->
                                            <table style="width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
                                                <tr>
                                                    <td align="center" style="padding: 24px 0;">
                                                        <div style="background-color: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 12px; padding: 24px 40px; display: inline-block;">
                                                            <span style="font-family: 'Inter', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #4F46E5; line-height: 1;">
                                                                ${otpData.otp}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>

                                            <p style="margin: 0; font-size: 14px; line-height: 24px; color: #6B7280; text-align: center;">
                                                If you didn't request a password reset, you can safely ignore this email.
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
        return NextResponse.json({ message: "We have sent you an OTP for Resetting Password!" }, { status: 200 });

    } catch (error) {
        console.log(error);
        console.log(Error)
        return NextResponse.json({
            error: "Error sending email"
        }, { status: 404 })

    }
}

export async function PATCH(req: NextRequest) {
    try {
        const { email, otp, newPassword } = await req.json();
        if (!otp || !newPassword) {
            return NextResponse.json({ error: "ALL Fields Required!" }, { status: 404 })
        }

        if (newPassword.length < 8) {
            return NextResponse.json({ error: "New Password must be 8 characters long!" }, { status: 404 })
        }

        const currentTime = new Date();

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        if (email === email && otpData.otp === otp) {
            const expiryTime = new Date(otpData.expiry);
            if (currentTime < expiryTime) {
                const user = await prisma.user.update({
                    where: { email },
                    data: { password: hashedPassword },
                });

                return NextResponse.json({ message: "Your password has been reset successfully" }, { status: 200 });
            } else {
                return NextResponse.json({ error: "The OTP You entered has expired" }, { status: 400 });
            }
        } else {
            return NextResponse.json({ error: "Your OTP is incorrect" }, { status: 400 });
        }


    } catch (error) {
        console.error("Error verifying OTP:", error);
        return NextResponse.json({ error: "Error verifying OTP" }, { status: 500 });

    }
}
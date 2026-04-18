import { NextRequest, NextResponse } from "next/server";
import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { sendMail } from "@/utils/mail";
import { redis } from "@/utils/redis";
import { rateLimit } from "@/utils/rateLimiter";
import { getClientIp } from "@/utils/ip";

export async function POST(req: NextRequest) {
    try {
        const user = await currentLoggedInUserInfo();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const clientIp = getClientIp(req);
        const userKey = `rl:verify_payment:user:${user.id}`;
        const userAllowed = await rateLimit({ key: userKey, limit: 10, windowSeconds: 300 });

        if (!userAllowed) {
            return NextResponse.json(
                { error: `Too many payment verification attempts. Try again in ${await redis.ttl(userKey)} seconds.` },
                { status: 429 }
            );
        }

        const ipKey = `rl:verify_payment:ip:${clientIp}`;
        const ipAllowed = await rateLimit({ key: ipKey, limit: 25, windowSeconds: 300 });

        if (!ipAllowed) {
            return NextResponse.json(
                { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
                { status: 429 }
            );
        }

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            paymentId,
            planId,
            orderId
        } = await req.json();

        if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature ||
            !paymentId
        ) {
            return NextResponse.json(
                { error: "Missing parameters" },
                { status: 400 }
            );
        }

        const key_secret = process.env.RAZORPAY_SECRET as string;
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", key_secret)
            .update(body)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 400 }
            );
        }

        const transaction = await prisma.transaction.findUnique({
            where: { id: paymentId },
            include: { user: true },
        });


        if (!transaction) {
            return NextResponse.json(
                { error: "Transaction not found" },
                { status: 404 }
            );
        }

        if (transaction.user.email !== user.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (transaction.status === "SUCCESS") {
            return NextResponse.json({ message: "Payment already verified" });
        }


        const invoice = await prisma.invoice.findFirst({
            where: {
                userId: user.id,
                paymentGatewayId: razorpay_order_id,
                invoiceStatus: "UNPAID"
            },
        });

        if (!invoice) {
            return NextResponse.json(
                { error: "Invoice not found" },
                { status: 404 }
            );
        }

        const updatedTransaction = await prisma.transaction.update({
            where: { id: paymentId },
            data: {
                status: "SUCCESS",
                transactionDate: new Date(),
                additionalInfo: {
                    razorpay_order_id,
                    razorpay_payment_id,
                    razorpay_signature,
                    planId,
                },
            },
        });

        const updatedInvoice = await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
                invoiceStatus: "PAID",
                paymentStatus: "SUCCESS",
                paymentDate: new Date(),
                paidDate: new Date(),
                paymentMethod: "RAZORPAY",
                paymentGatewayId: razorpay_payment_id,
            },
        });

        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                subscription_plan: planId,
                next_billing_date: nextBillingDate,
            },
        });

        const planName = planId === "CREATOR" ? "Creator" : "Premium";
        const planAmount = planId === "CREATOR" ? 499 : 999;
        const taxAmount = Math.round(planAmount * 0.18);
        const totalAmount = planAmount + taxAmount;
        const invoiceNumber = updatedInvoice.invoiceNumber;

        await prisma.notification.create({
            data: {
                userId: user.id,
                title: "Payment Successful",
                message: `Payment of ₹${totalAmount} for ${planName} plan has been processed successfully. Invoice: ${invoiceNumber}`,
                isRead: false,
            },
        });

        const invoiceDate = new Date(invoice.issueDate).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });

        const nextBillDate = nextBillingDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });

        const subject = `Payment Confirmation - Invoice ${invoiceNumber}`;
        const to = user.email;
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
    <title>Payment Receipt - ${invoiceNumber}</title>
    <style>
        @media (max-width: 600px) {
            .sm-w-full { width: 100% !important; }
            .sm-px-4 { padding-left: 16px !important; padding-right: 16px !important; }
            .sm-stack { display: block !important; width: 100% !important; }
            .sm-text-center { text-align: center !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div role="article" aria-roledescription="email">
        <table style="width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
                <td align="center" style="padding: 40px 16px;">
                    <table class="sm-w-full" style="max-width: 600px; width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                            <td align="center" style="padding-bottom: 32px;">
                                <a href="https://zyvarin.com" style="text-decoration: none;">
                                    <div style="background-color: #4F46E5; color: white; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700;">Z</div>
                                    <p style="margin-top: 8px; color: #64748b; font-size: 14px;">Zyvarin Social</p>
                                </a>
                            </td>
                        </tr>

                        <tr>
                            <td class="sm-px-4">
                                <table style="width: 100%; background-color: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;" cellpadding="0" cellspacing="0" role="presentation">
                                    <tr>
                                        <td style="padding: 40px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                                            <div style="width: 60px; height: 60px; background-color: #dcfce7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                                                <svg style="width: 30px; height: 30px; color: #16a34a;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                                </svg>
                                            </div>
                                            <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #0f172a;">Payment Successful</h1>
                                            <p style="margin: 0 0 20px; color: #64748b;">Thank you for your payment!</p>
                                            <p style="margin: 0; font-size: 36px; font-weight: 700; color: #0f172a;">₹${totalAmount}</p>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding: 32px 40px;">
                                            <table style="width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
                                                <tr class="sm-stack">
                                                    <td style="padding-bottom: 24px; width: 50%; vertical-align: top;">
                                                        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Billed To</p>
                                                        <p style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #0f172a;">${user.fullName || user.email}</p>
                                                        <p style="margin: 0; color: #64748b;">${user.email}</p>
                                                    </td>
                                                    <td style="padding-bottom: 24px; width: 50%; vertical-align: top; text-align: right;">
                                                        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Invoice Details</p>
                                                        <table style="display: inline-block; text-align: left;" cellpadding="0" cellspacing="0" role="presentation">
                                                            <tr>
                                                                <td style="padding-bottom: 4px; color: #64748b;">Invoice:</td>
                                                                <td style="padding-bottom: 4px; padding-left: 12px; font-weight: 600; color: #0f172a;">${invoiceNumber}</td>
                                                            </tr>
                                                            <tr>
                                                                <td style="padding-bottom: 4px; color: #64748b;">Date:</td>
                                                                <td style="padding-bottom: 4px; padding-left: 12px; font-weight: 600; color: #0f172a;">${invoiceDate}</td>
                                                            </tr>
                                                            <tr>
                                                                <td style="color: #64748b;">Status:</td>
                                                                <td style="padding-left: 12px; font-weight: 700; color: #10b981;">Paid</td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>

                                            <table style="width: 100%; border-collapse: collapse; margin-top: 8px;" cellpadding="0" cellspacing="0" role="presentation">
                                                <thead>
                                                    <tr>
                                                        <th align="left" style="padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Description</th>
                                                        <th align="right" style="padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td style="padding: 16px 0; border-bottom: 1px solid #f1f5f9;">
                                                            <p style="margin: 0; font-weight: 600; color: #0f172a;">${planName} Plan Subscription</p>
                                                            <p style="margin: 4px 0 0; color: #64748b;">${invoice.itemDescription || 'Monthly subscription'}</p>
                                                        </td>
                                                        <td align="right" style="padding: 16px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #0f172a;">₹${planAmount}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 16px 0; border-bottom: 2px solid #e2e8f0;">
                                                            <p style="margin: 0; color: #64748b;">GST (18%)</p>
                                                        </td>
                                                        <td align="right" style="padding: 16px 0; border-bottom: 2px solid #e2e8f0; color: #64748b;">₹${taxAmount}</td>
                                                    </tr>
                                                </tbody>
                                                <tfoot>
                                                    <tr>
                                                        <td align="right" style="padding-top: 16px; padding-right: 8px; font-size: 14px; font-weight: 600; color: #0f172a;">Subtotal</td>
                                                        <td align="right" style="padding-top: 16px; font-size: 14px; font-weight: 600; color: #0f172a;">₹${planAmount}</td>
                                                    </tr>
                                                    <tr>
                                                        <td align="right" style="padding-top: 8px; padding-right: 8px; font-size: 14px; color: #64748b;">Tax (18%)</td>
                                                        <td align="right" style="padding-top: 8px; font-size: 14px; color: #64748b;">₹${taxAmount}</td>
                                                    </tr>
                                                    <tr>
                                                        <td align="right" style="padding-top: 16px; padding-right: 8px; font-size: 16px; font-weight: 700; color: #0f172a;">Total</td>
                                                        <td align="right" style="padding-top: 16px; font-size: 20px; font-weight: 700; color: #4F46E5;">₹${totalAmount}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding: 0 40px 32px;">
                                            <table style="width: 100%; background-color: #f8fafc; border-radius: 8px; padding: 20px;" cellpadding="0" cellspacing="0" role="presentation">
                                                <tr>
                                                    <td>
                                                        <p style="margin: 0 0 12px; font-weight: 600; color: #0f172a;">Subscription Details</p>
                                                        <p style="margin: 0 0 8px; color: #64748b;">
                                                            <span style="font-weight: 500;">Plan:</span> ${planName} Plan (₹${planAmount}/month)
                                                        </p>
                                                        <p style="margin: 0 0 8px; color: #64748b;">
                                                            <span style="font-weight: 500;">Billing Cycle:</span> Monthly
                                                        </p>
                                                        <p style="margin: 0; color: #64748b;">
                                                            <span style="font-weight: 500;">Next Billing Date:</span> ${nextBillDate}
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td align="center" style="padding-bottom: 40px;">
                                            <a href="https://app.zyvarin.com/dashboard/billing" style="background-color: #4F46E5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; text-align: center;">View in Dashboard</a>
                                            <p style="margin-top: 12px; color: #64748b; font-size: 14px;">Transaction ID: ${razorpay_payment_id}</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <tr>
                            <td style="padding: 32px 0; text-align: center; color: #64748b; font-size: 14px;">
                                <p style="margin: 0 0 8px;">Zyvarin Social • Social Media Management Platform</p>
                                <p style="margin: 0 0 16px;">Need help? <a href="mailto:support@zyvarin.com" style="color: #4F46E5; text-decoration: none;">Contact Support</a></p>
                                <p style="margin: 0; font-size: 12px; color: #94a3b8;">Transaction ID: ${razorpay_payment_id} • ${new Date().toLocaleDateString('en-IN')}</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>`;

        await sendMail({
            email: user.email,
            to,
            subject,
            htmlContent,
        });

        return NextResponse.json({
            message: "Payment verified successfully",
            success: true,
            paymentId: updatedTransaction.id,
            invoiceNumber: invoiceNumber,
            plan: planId,
            nextBillingDate: nextBillingDate,
            amount: totalAmount,
        });
    } catch (error) {
        console.error("Error verifying payment:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                success: false
            },
            { status: 500 }
        );
    }
}
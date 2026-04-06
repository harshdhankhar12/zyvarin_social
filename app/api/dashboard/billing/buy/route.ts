import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo";
import prisma from "@/lib/prisma";


const key_id = process.env.RAZORPAY_KEY_ID as string;
const key_secret = process.env.RAZORPAY_SECRET as string;

if (!key_id || !key_secret) {
    throw new Error("Razorpay keys are missing");
}

const razorpay = new Razorpay({
    key_id,
    key_secret
})



export async function POST(req: NextRequest) {
    const user = await currentLoggedInUserInfo();
    if (!user) {
        return NextResponse.json({
            error: "UnAuthorized!"
        }, { status: 401 })
    }

    try {
        const plans = ['FREE', 'CREATOR', 'PREMIUM'];
        const { planId, price } = await req.json();
        if (!plans.includes(planId)) {
            return NextResponse.json({
                error: "Invalid Plan!"
            }, { status: 400 })
        }

        const currency = "INR";
        let updatedAmount = price * 100;
        updatedAmount = updatedAmount + (updatedAmount * 0.18); // Adding 18% GST
        updatedAmount = Math.round(updatedAmount);
        const options = {
            amount: updatedAmount,
            currency,
            receipt: `receipt_${Date.now()}`,
        }

        const order = await razorpay.orders.create(options);

        const payment = await prisma.transaction.create({
            data: {
                userId: user.id,
                amount: updatedAmount / 100,
                paymentMethod: "RAZORPAY",
                currency,
                transactionDate: new Date(),
                status: "PENDING",
                additionalInfo: {
                    orderId: order.id,
                    planId,
                }
            }
        })

        await prisma.invoice.create({
            data: {
                userId: user.id,
                dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                invoiceNumber: `INV-${Date.now()}`,
                invoiceStatus: "UNPAID",
                issueDate: new Date(),
                orderId: order.id,
                paymentDate: new Date(),
                itemDescription: `${planId} Plan Subscription`,
                paymentGatewayId: order.id,
                paymentMethod: "RAZORPAY",
                paymentStatus: "PENDING",
                plan: planId,
                subTotal: price,
                taxAmount: price * 0.18,
                totalAmount: price + (price * 0.18),
                currency,
                itemQuantity: 1,
            }
        })

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            paymentId: payment!.id,
        }, { status: 200 });

    } catch (error) {
        console.log(error);
        return NextResponse.json({
            error: "Internal Server Error"
        }, { status: 500 })

    }
}

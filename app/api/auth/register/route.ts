import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
    try {
        const { fullName, email, password } = await req.json();

        const sanitizedFullName = fullName?.trim() || '';
        const sanitizedEmail = email?.trim().toLowerCase() || '';
        const sanitizedPassword = password?.trim() || '';

        if (sanitizedPassword === '' || sanitizedEmail === '' || sanitizedFullName === '') {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sanitizedEmail)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        if (sanitizedEmail.includes('+')) {
            return NextResponse.json({ error: 'Email addresses with + symbol are not allowed' }, { status: 400 });
        }

        if (!sanitizedEmail.endsWith('@gmail.com') && !sanitizedEmail.endsWith('@zohomail.in')) {
            return NextResponse.json({ error: 'Only Gmail and Zoho Mail addresses are allowed' }, { status: 400 });
        }

        if (sanitizedPassword.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
        }

        const hasUpperCase = /[A-Z]/.test(sanitizedPassword);
        const hasLowerCase = /[a-z]/.test(sanitizedPassword);
        const hasNumbers = /[0-9]/.test(sanitizedPassword);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(sanitizedPassword);

        if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
            return NextResponse.json({
                error: 'Password must contain uppercase, lowercase, numbers, and special characters'
            }, { status: 400 });
        }

        if (sanitizedFullName.length < 3) {
            return NextResponse.json({ error: 'Full name must be at least 3 characters long' }, { status: 400 });
        }

        const existingUser = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
        if (existingUser) {
            return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
        }


        const hashedPassword = await bcrypt.hash(sanitizedPassword, 10);

        const user = await prisma.user.create({
            data: {
                fullName: sanitizedFullName,
                email: sanitizedEmail,
                password: hashedPassword,
                subscription_status: "ACTIVE"
            },
        });

        return NextResponse.json({ message: 'You have registered successfully. Please verify your email to continue.' }, { status: 201 });

    } catch (error) {
        console.log(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo";

export async function POST(req: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { redis } = await import("@/utils/redis");
    const { rateLimit } = await import("@/utils/rateLimiter");
    const { getClientIp } = await import("@/utils/ip");

    const clientIp = getClientIp(req);
    const userKey = `rl:downvote_blog:user:${session.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 30, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many voting requests. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:downvote_blog:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 60, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    const { blogId } = await req.json();

    if (!blogId) {
      return NextResponse.json({ error: "Blog ID is required" }, { status: 400 });
    }

    const blog = await prisma.blog.findUnique({
      where: { id: blogId }
    });

    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    const existingDownvote = await prisma.blogDownvote.findUnique({
      where: {
        blogId_userId: {
          blogId,
          userId: session.id
        }
      }
    });

    if (existingDownvote) {
      await prisma.blogDownvote.delete({
        where: { id: existingDownvote.id }
      });

      const updatedBlog = await prisma.blog.update({
        where: { id: blogId },
        data: {
          downvotes: {
            decrement: 1
          }
        }
      });

      return NextResponse.json({
        message: "Downvote removed",
        downvotes: updatedBlog.downvotes
      }, { status: 200 });
    }

    const existingUpvote = await prisma.blogUpvote.findUnique({
      where: {
        blogId_userId: {
          blogId,
          userId: session.id
        }
      }
    });

    if (existingUpvote) {
      await prisma.blogUpvote.delete({
        where: { id: existingUpvote.id }
      });

      await prisma.blog.update({
        where: { id: blogId },
        data: {
          upvotes: {
            decrement: 1
          }
        }
      });
    }

    await prisma.blogDownvote.create({
      data: {
        blogId,
        userId: session.id
      }
    });

    const updatedBlog = await prisma.blog.update({
      where: { id: blogId },
      data: {
        downvotes: {
          increment: 1
        }
      }
    });

    return NextResponse.json({
      message: "Downvote added",
      downvotes: updatedBlog.downvotes
    }, { status: 201 });
  } catch (error) {
    console.error("Error downvoting blog:", error);
    return NextResponse.json({ error: "Failed to downvote" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const blogId = searchParams.get("blogId");
    const session = await currentLoggedInUserInfo();

    if (!blogId) {
      return NextResponse.json({ error: "Blog ID is required" }, { status: 400 });
    }

    const downvotes = await prisma.blogDownvote.count({
      where: { blogId }
    });

    let userDownvoted = false;
    if (session) {
      const userDownvote = await prisma.blogDownvote.findUnique({
        where: {
          blogId_userId: {
            blogId,
            userId: session.id
          }
        }
      });
      userDownvoted = !!userDownvote;
    }

    return NextResponse.json({ downvotes, userDownvoted }, { status: 200 });
  } catch (error) {
    console.error("Error fetching downvotes:", error);
    return NextResponse.json({ error: "Failed to fetch downvotes" }, { status: 500 });
  }
}

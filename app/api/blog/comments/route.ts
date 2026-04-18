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
    const userKey = `rl:create_comment:user:${session.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 20, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many comment requests. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:create_comment:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 50, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    const { blogId, content } = await req.json();

    if (!blogId || !content?.trim()) {
      return NextResponse.json({ error: "Blog ID and content are required" }, { status: 400 });
    }

    if (content.trim().length < 3) {
      return NextResponse.json({ error: "Comment must be at least 3 characters" }, { status: 400 });
    }

    if (content.trim().length > 1000) {
      return NextResponse.json({ error: "Comment must be less than 1000 characters" }, { status: 400 });
    }

    const blog = await prisma.blog.findUnique({
      where: { id: blogId }
    });

    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    const comment = await prisma.blogComment.create({
      data: {
        blogId,
        userId: session.id,
        content: content.trim(),
        approved: true
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true
          }
        }
      }
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const blogId = searchParams.get("blogId");

    if (!blogId) {
      return NextResponse.json({ error: "Blog ID is required" }, { status: 400 });
    }

    const comments = await prisma.blogComment.findMany({
      where: {
        blogId,
        approved: true
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json({ comments }, { status: 200 });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { redis } = await import("@/utils/redis");
    const { rateLimit } = await import("@/utils/rateLimiter");
    const { getClientIp } = await import("@/utils/ip");

    const clientIp = getClientIp(req);
    const userKey = `rl:delete_comment:user:${session.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 15, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many delete requests. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:delete_comment:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 40, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json({ error: "Comment ID is required" }, { status: 400 });
    }

    const comment = await prisma.blogComment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (comment.userId !== session.id) {
      return NextResponse.json({ error: "Unauthorized to delete this comment" }, { status: 403 });
    }

    await prisma.blogComment.delete({
      where: { id: commentId }
    });

    return NextResponse.json({ message: "Comment deleted" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}

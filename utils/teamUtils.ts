import prisma from "@/lib/prisma";

export async function isTeamOwner(userId: string, teamId: string): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true }
  });
  return team?.ownerId === userId;
}

export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  const member = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId
      }
    }
  });
  return !!member;
}

export async function canManageMembers(userId: string, teamId: string): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true }
  });
  
  if (team?.ownerId === userId) return true;
  
  const member = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId
      }
    },
    select: { role: true, status: true }
  });
  
  return member?.status === 'ACCEPTED' && member?.role === 'ADMIN';
}

export async function getMemberRole(userId: string, teamId: string): Promise<string | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true }
  });
  
  if (team?.ownerId === userId) return 'OWNER';
  
  const member = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId
      }
    },
    select: { role: true }
  });
  
  return member?.role || null;
}

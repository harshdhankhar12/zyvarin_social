import React from 'react'
import { Users, Plus, FolderPenIcon, Crown, Calendar, CheckCircle, Clock, SettingsIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import CreateNewTeam from '@/components/Dashboard/Teams/CreateNewTeam'
import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'

const page = async ({ searchParams }: { searchParams: Promise<{ team?: string, action?: string }> }) => {
    const params = await searchParams;
    const team = params.team;
    const action = params.action;

    const isDisabled = true;

    if(isDisabled){
        return (
            <>
                <div className="flex items-center justify-center min-h-screen px-4">
                    <div className="max-w-md w-full text-center space-y-6 p-8 border border-slate-200 rounded-lg shadow">
                        <div className="mx-auto w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center">
                            <FolderPenIcon className="w-10 h-10 text-accent" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-slate-900">Teams Feature Disabled</h2>
                            <p className="text-slate-600">
                                The Teams feature is currently disabled for maintenance. Please check back later.
                            </p>
                        </div>
                    </div>
                </div>
            </>
        )
    }

    const session = await currentLoggedInUserInfo();
    if(!session){
        return null;
    }
    let userTeams: any[] = [];

    if (session && typeof session !== 'boolean') {
        userTeams = await prisma.team.findMany({
            where: {
                OR: [
                    { ownerId: session.id },
                    {
                        members: {
                            some: {
                                userId: session.id,
                                status: 'ACCEPTED'
                            }
                        }
                    }
                ]
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        fullName: true
                    }
                },
                members: {
                    where: {
                        userId: session.id
                    },
                    select: {
                        role: true,
                        status: true
                    }
                },
                _count: {
                    select: {
                        members: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    const hasTeams = userTeams.length > 0;


    const UserWithNoTeams = () => {
        return (
            <div className="flex items-center justify-center min-h-screen ">
                <div className=" w-full text-center space-y-6 p-8">
                    <div className="mx-auto w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center">
                        <Users className="w-10 h-10 text-accent" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-slate-900">No Teams Yet</h2>
                        <p className="text-slate-600">
                            Create your first team to start collaborating with your team members on social media management.
                        </p>
                    </div>

                    <Link href="/dashboard/teams?action=create-team">
                        <Button className="bg-accent hover:bg-accent/90 text-white gap-2 mt-6">
                            <Plus className="w-4 h-4" />
                            Create Your First Team
                        </Button>
                    </Link>


                </div>
            </div>
        )
    }

    const CreateTeamModal = () => {
        if (action !== 'create-team') return null;
        return <CreateNewTeam />;
    }

    const TeamsGrid = () => {
        return (
            <div className="p-6 mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Your Teams</h1>
                        <p className="text-slate-600 mt-1">Manage and collaborate with your teams</p>
                    </div>
                    <Link href="/dashboard/teams?action=create-team">
                        <Button className="">
                            <Plus className="w-4 h-4" />
                            Create Team
                        </Button>
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userTeams.map((team) => {
                        const isOwner = team.ownerId === session?.id;
                        const userMember = team.members[0];
                        const userRole = isOwner ? 'OWNER' : (userMember?.role || 'VIEWER');
                        
                        return (
                            <div 
                                key={team.id}
                                className="bg-white border border-slate-200 rounded-xl p-6 "
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                                        <Users className="w-6 h-6 text-accent" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {team.isVerified ? (
                                            <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                <CheckCircle className="w-3 h-3" />
                                                Verified
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                                                <Clock className="w-3 h-3" />
                                                Pending
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-1">
                                    {team.name}
                                </h3>
                                
                                {team.description && (
                                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                                        {team.description.length > 100 ? team.description.substring(0, 100) + '...' : team.description}
                                    </p>
                                )}

                                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Users className="w-4 h-4" />
                                        <span>{team._count.members} member{team._count.members !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs">
                                        {isOwner ? (
                                            <>
                                                <Crown className="w-3 h-3 text-amber-500" />
                                                <span className="text-amber-700 font-medium">Owner</span>
                                            </>
                                        ) : (
                                            <span className={`px-2 py-1 rounded-full font-medium ${
                                                userRole === 'ADMIN' ? 'bg-blue-100 text-blue-700' :
                                                userRole === 'EDITOR' ? 'bg-purple-100 text-purple-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                                {userRole}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                                    <Link href={`/dashboard/teams/${team.slug}`} className="flex-1">
                                        <Button variant="outline" className="w-full text-sm">
                                            View Team
                                        </Button>
                                    </Link>
                                    {(isOwner || userRole === 'ADMIN') && (
                                        <Link href={`/dashboard/teams/${team.slug}?tab=settings`}>
                                            <Button variant="outline">
                                                <SettingsIcon className="w-4 h-4" />
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )
    }

    return (
        <>
            <CreateTeamModal />
            {!hasTeams ? (
                <UserWithNoTeams />
            ) : (
                <TeamsGrid />
            )}
        </>
    )
}

export default page

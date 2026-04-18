"use client"
import React, { useState, useEffect } from 'react';
import { HelpCircle, Bell, ChevronDown, User, Settings, CreditCard, Receipt, Shield, LogOut, Bug, Users, Plus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import NotificationModal from '@/components/Dashboard/NotificationModal';
import SearchBar from '@/components/Dashboard/SearchBar';
import axios from 'axios';

interface User {
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  senderType: 'ADMIN' | 'SYSTEM';
  createdAt: string;
}

interface Team {
  id: string;
  name: string;
  memberCount: number;
  slug: string;
}

const TopNavbar: React.FC<{ user: User; teams: Team[] }> = ({ user, teams }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(teams.length > 0 ? teams[0] : null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleNotificationClick = async () => {
    const hasUnread = notifications.some(n => !n.isRead);

    if (hasUnread && !isLoadingNotifications) {
      setIsLoadingNotifications(true);
      try {
        const response = await axios.post('/api/notifications/mark-read');

        if (response.status === 200 && response.data.success) {
          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
          setUnreadCount(0);
        }
      } catch (error) {
        console.error('Error marking notifications as read:', error);
      } finally {
        setIsLoadingNotifications(false);
      }
    }

    setIsModalOpen(true);
  };
  return (
    <header className="fixed w-full h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20">
      <div className="flex items-center gap-4">


        <div className="flex items-center gap-3">
          <Image
            src="/zyvarin-logo_1.png"
            alt="Zyvarin Logo"
            width={120}
            height={40}
            className="w-32 h-auto md:w-40 -ml-12 object-contain md:-ml-16"
          />
          <Link href="/dashboard" className=" md:block -ml-12 text-gray-700 hover:text-gray-900">
            <h1 className=" text-2xl md:text-3xl font-bold tracking-tight flex gap-2">
              <span className="text-accent">
                Zyvarin</span>
              Dashboard</h1>
          </Link>
        </div>

        {/* <div className="hidden md:block ml-8">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
                <Users className="w-4 h-4 text-accent" />
                {selectedTeam ? (
                  <>
                    <span className="text-sm font-medium text-slate-700">{selectedTeam.name}</span>
                    <span className="text-xs text-slate-500">({selectedTeam.memberCount})</span>
                  </>
                ) : (
                  <span className="text-sm font-medium text-slate-700">No Teams</span>
                )}
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs font-semibold text-slate-500 px-2 py-1">
                YOUR TEAMS
              </DropdownMenuLabel>
              {teams.length > 0 ? (
                teams.map((team) => (
                  <Link key={team.id} href={`/dashboard/teams/${team.slug}`}>
                    <DropdownMenuItem 
                      onClick={() => setSelectedTeam(team)}
                      className={`flex items-center gap-3 cursor-pointer ${selectedTeam?.id === team.id ? 'bg-accent/10' : ''}`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-md bg-accent/20 flex items-center justify-center">
                          <Users className="w-4 h-4 text-accent" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900">{team.name}</span>
                          <span className="text-xs text-slate-500">{team.memberCount} member{team.memberCount > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      {selectedTeam?.id === team.id && (
                        <div className="w-2 h-2 rounded-full bg-accent"></div>
                      )}
                    </DropdownMenuItem>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-slate-500 text-center">
                  No teams yet
                </div>
              )}
              <DropdownMenuSeparator />
              <Link href="/dashboard/teams">
                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-accent">
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Create Team</span>
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
        </div> */}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block w-48 md:w-64">
          <SearchBar />
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>

        <Link href="/dashboard/help" className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors hidden sm:block">
          <HelpCircle className="w-5 h-5" />
        </Link>
        <button
          onClick={handleNotificationClick}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative"
          disabled={isLoadingNotifications}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <>
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 pl-2 pr-1 py-1 hover:bg-slate-100 rounded-full transition-colors">
              <Image
                src={user.avatarUrl || '/default-avatar.png'}
                alt="User"
                width={32}
                height={32}
                className="w-8 h-8 rounded-full border border-slate-200"
              />
              <span className="hidden sm:block text-sm font-medium text-slate-700">{user.fullName}</span>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">{user.fullName}</span>
                <span className="text-xs text-gray-500">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/profile" className="flex items-center gap-2 cursor-pointer">
                <User className="w-4 h-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/billing" className="flex items-center gap-2 cursor-pointer">
                <CreditCard className="w-4 h-4" />
                <span>Billing & Plans</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/transactions-history?page=1" className="flex items-center gap-2 cursor-pointer">
                <Receipt className="w-4 h-4" />
                <span>Transaction History</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/security" className="flex items-center gap-2 cursor-pointer">
                <Shield className="w-4 h-4" />
                <span>Security</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/help" className="flex items-center gap-2 cursor-pointer">
                <HelpCircle className="w-4 h-4" />
                <span>Help & Support</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/report-bug" className="flex items-center gap-2 cursor-pointer">
                <Bug className="w-4 h-4" />
                <span>Report a Bug</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: '/signin' })}
              className="flex items-center gap-2 cursor-pointer text-red-600"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        notifications={notifications}
      />
    </header>
  );
};

export default TopNavbar;
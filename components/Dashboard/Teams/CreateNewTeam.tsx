"use client"
import React, { useState } from 'react'
import { Users, Plus, FolderPenIcon, Loader } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import axios from 'axios'
import { useRouter } from 'next/navigation'

const CreateNewTeam = () => {
    const [teamName, setTeamName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [isVerficationModalOpen, setIsVerificationModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [otp, setOtp] = useState('');
    const [teamId, setTeamId] = useState<string>('');
    const router = useRouter();

    const handleCreateTeam = async () => {
        try {
            setLoading(true);
            const response = await axios.post('/api/dashboard/teams/create', {
                name: teamName,
                description: description
            });
            if(response.status === 201){
                const createdTeamId = response.data.teamId;
                setTeamId(createdTeamId);
                setSuccessMessage('Team created. Check your email for the verification code.');
                setErrorMessage('');
                setIsVerificationModalOpen(true);

                // Trigger OTP email
                try {
                    await axios.post('/api/dashboard/teams/verify', { teamId: createdTeamId });
                    setSuccessMessage('Team created. We sent you a verification code via email.');
                } catch (err:any) {
                    setErrorMessage(err.response?.data?.error || 'Failed to send verification code. Please try again.');
                }

                setTeamName('');
                setDescription('');
            }
            
        } catch (error:any) {
            console.error("Error creating team:", error);
            setErrorMessage(error.response?.data?.error || 'Failed to create team');

        }finally{
            setLoading(false);
        }
    }

    const handleVerifyOtp = async () => {
        setLoading(true);
        setErrorMessage('');
        setSuccessMessage('');
        try {
            const response = await axios.patch('/api/dashboard/teams/verify', {
                otp: otp
            });
            if(response.status === 200){
                setSuccessMessage(response.data.message || 'Team verified successfully');
                setErrorMessage('');
                setIsVerificationModalOpen(false);
                setTimeout(() => {
                    router.push('/dashboard/teams');
                    router.refresh();
                }, 1500);
            }
        } catch (error:any) {
            console.error("Error verifying OTP:", error);
            setErrorMessage(error.response?.data?.error || 'Failed to verify OTP');
        } finally {
            setLoading(false);  
        }
    }





         return (
            <>
             <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                 <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                     <div className="flex items-center justify-between">
                         <h3 className="text-xl font-bold text-slate-900">Create New Team</h3>
                         <Link href="/dashboard/teams">
                             <button className="text-slate-400 hover:text-slate-600">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                 </svg>
                             </button>
                         </Link>
                     </div>
 
                    {errorMessage && <p className="bg-red-100 text-red-700 p-3 font-medium rounded-md text-sm">{errorMessage}</p>}
                     {successMessage && <p className="bg-green-100 text-green-700 p-3 font-medium rounded-md text-sm">{successMessage}</p>}
                     <div className="space-y-4">
                         <label className="block text-sm font-medium text-slate-700 mb-1">
                             Team Name
                         </label>
                         <div>
 
                             <div className="absolute inset-y-0 -top-28 pl-4 flex items-center pointer-events-none">
                                 <FolderPenIcon className="h-5 w-5 text-slate-400" />
                             </div> 
                             <Input
                                 type="text"
                                 placeholder="e.g., Marketing Team"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                 className="h-12 w-full font-medium"
                             />
                         </div>
                     </div>
 
                     <div>
                         <label className="block text-sm font-medium text-slate-700 mb-1">
                             Description (Optional)
                         </label>
                         <Textarea
                             placeholder="What's this team for?"
                             rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                         />
                     </div>
 
                     <div className="flex gap-3 pt-2">
                         <Link href="/dashboard/teams" className="flex-1">
                             <Button variant="outline" className="w-full">
                                 Cancel
                             </Button>
                         </Link>
                         <Button onClick={handleCreateTeam} disabled={loading || !teamName || teamName.trim() === ''}
                         className="flex-1 bg-accent hover:bg-accent/90 text-white">
                             {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Create Team'}
                         </Button>
                     </div>
                 </div>
             </div>

             {isVerficationModalOpen && (
                      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 w-full max-w-md">
            {errorMessage && (
              <div className="mb-4 p-4 bg-red-100 text-red-700 border border-red-300 rounded">
                {errorMessage}
                </div>
            )}
            {successMessage && (
              <div className="mb-4 p-4 bg-green-100 text-green-700 border border-green-300 rounded">
                {successMessage}
              </div>
            )}
            <h2 className="text-2xl font-bold mb-4">Enter Verification Code</h2>
            
            <Input
              type="number"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter OTP received via email"
              className='pl-6 text-center'
            />
            <div className="mt-6 flex justify-end">
              <Button
                variant="secondary"
                className="mr-4"
                onClick={() => setIsVerificationModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                onClick={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (<Loader className="animate-spin h-5 w-5 mx-auto" />) : 'Verify Code'}
              </Button>
            </div>
        </div>
      </div>

             )}
          </>

         )
 
}

export default CreateNewTeam

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowLeft, Edit2, Save, X, Plus, TrendingUp, History, Camera, Upload, MapPin, ShieldCheck, Users, Search, Video, Play, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { 
  DialogHeader, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

export default function Profile() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAddingLift, setIsAddingLift] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<number | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [newGymName, setNewGymName] = useState("");
  const [newGymSlug, setNewGymSlug] = useState("");
  const [newGymCode, setNewGymCode] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{ exercise: string; url: string } | null>(null);
  const [videoProgress, setVideoProgress] = useState<{ stage: string; percent: number } | null>(null);
  const [selectingJudges, setSelectingJudges] = useState<string | null>(null);
  const [tempJudgeIds, setTempJudgeIds] = useState<number[]>([]);

  const { data: allUsers = [], refetch: refetchUsers } = trpc.admin.listUsers.useQuery(undefined, {
    enabled: user?.role === 'admin'
  });
  const { data: gymRequests = [], refetch: refetchGymRequests } = trpc.admin.listGymRequests.useQuery(undefined, {
    enabled: user?.role === 'admin'
  });

  const setUserRoleMutation = trpc.admin.setUserRole.useMutation();
  const updateGymRequestMutation = trpc.admin.updateGymRequestStatus.useMutation();

  const exercises = [
    { id: "squat", label: "Squat" },
    { id: "bench", label: "Bench" },
    { id: "deadlift", label: "Deadlift" },
    { id: "ohp", label: "OHP" },
    { id: "farmersWalk", label: "Farmers Walk" },
    { id: "yokeWalk", label: "Yoke Walk" },
    { id: "dips", label: "Dips" },
    { id: "pullUps", label: "Pull Ups" },
  ];

  // If user has athleteId linked, use that, otherwise show selection OR allow them to create/link
  const athleteId = user?.athleteId || selectedAthleteId;

  const { data: athlete, isLoading: athleteLoading, refetch: refetchAthlete } = trpc.athlete.getById.useQuery(
    { id: athleteId || 0 },
    { enabled: !!athleteId }
  );

  const { data: liftHistory = [], refetch: refetchLifts } = trpc.athlete.getLiftHistory.useQuery(
    { athleteId: athleteId || 0 },
    { enabled: !!athleteId }
  );

  const { data: weightHistory = [], refetch: refetchWeight } = trpc.athlete.getWeightHistory.useQuery(
    { athleteId: athleteId || 0 },
    { enabled: !!athleteId }
  );

  // PR Videos
  const { data: prVideos = [], refetch: refetchPrVideos } = trpc.athlete.getPrVideos.useQuery(
    { athleteId: athleteId || 0 },
    { enabled: !!athleteId }
  );
  
  const { data: allJudgments = [], refetch: refetchJudgments } = trpc.athlete.getAllPrVideoJudgments.useQuery();
  const { data: communityUsers = [] } = trpc.system.getAllUsers.useQuery();

  const upsertPrVideoMutation = trpc.athlete.upsertPrVideo.useMutation();
  const deletePrVideoMutation = trpc.athlete.deletePrVideo.useMutation();
  const submitVoteMutation = trpc.athlete.submitPrVideoVote.useMutation({
    onSuccess: () => {
      toast.success("Vote recorded!");
      refetchJudgments();
    }
  });
  const assignJudgesMutation = trpc.athlete.assignPrVideoJudges.useMutation({
    onSuccess: () => {
      toast.success("Judges assigned successfully!");
      setSelectingJudges(null);
      refetchJudgments();
    }
  });

  const handleAssignJudges = () => {
    if (!athleteId || !selectingJudges) return;
    if (tempJudgeIds.length !== 3) {
      toast.error("You must select exactly 3 judges.");
      return;
    }
    assignJudgesMutation.mutate({
      athleteId,
      exerciseType: selectingJudges,
      judgeIds: tempJudgeIds
    });
  };

  const [formData, setFormData] = useState({
    name: "",
    bodyWeight: "",
    squat: "",
    bench: "",
    deadlift: "",
    ohp: "",
    farmersWalkWeight: "",
    farmersWalkDistance: "",
    yokeWalkWeight: "",
    yokeWalkDistance: "",
    dipsReps: "",
    dipsWeight: "",
    pullUpsReps: "",
    pullUpsWeight: "",
    avatarUrl: "",
    gender: "" as "" | "male" | "female",
  });

  const [newLift, setNewLift] = useState({
    exerciseType: "squat",
    weight: "",
    reps: "1",
    distance: "",
    recordedDate: new Date().toISOString().split('T')[0],
  });

  const updateProfileMutation = trpc.athlete.updateProfile.useMutation();
  const addLiftMutation = trpc.athlete.addLift.useMutation();
  const addWeightMutation = trpc.athlete.addWeight.useMutation();
  const joinGymMutation = trpc.gym.join.useMutation();
  const leaveGymMutation = trpc.gym.leave.useMutation();
  const createGymMutation = trpc.gym.create.useMutation();

  const parseNumberInput = (value: string) => (value.trim() === "" ? undefined : parseFloat(value));
  const parseIntInput = (value: string) => (value.trim() === "" ? undefined : parseInt(value, 10));

  const [gymInviteCode, setGymInviteCode] = useState("");
  const [isChangingGym, setIsChangingGym] = useState(false);
  const { data: gym } = trpc.gym.getById.useQuery(
    { id: athlete?.gymId || 0 },
    { enabled: !!athlete?.gymId }
  );

  const handleJoinGym = async () => {
    try {
      await joinGymMutation.mutateAsync({ inviteCode: gymInviteCode });
      toast.success("Joined Gym Space!");
      setGymInviteCode("");
      setIsChangingGym(false);
      refetchAthlete();
    } catch (e: any) {
      toast.error(e.message || "Failed to join gym");
    }
  };

  const handleLeaveGym = async () => {
    if (!confirm("Are you sure you want to leave this Gym Space?")) return;
    try {
      await leaveGymMutation.mutateAsync();
      toast.success("Left Gym Space");
      refetchAthlete();
      setIsChangingGym(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to leave gym");
    }
  };

  const handleSave = async () => {
    if (!athleteId) return;
    try {
      await updateProfileMutation.mutateAsync({
        athleteId,
        name: formData.name || undefined,
        bodyWeight: parseNumberInput(formData.bodyWeight),
        squat: parseNumberInput(formData.squat),
        bench: parseNumberInput(formData.bench),
        deadlift: parseNumberInput(formData.deadlift),
        ohp: parseNumberInput(formData.ohp),
        farmersWalkWeight: parseNumberInput(formData.farmersWalkWeight),
        farmersWalkDistance: parseNumberInput(formData.farmersWalkDistance),
        yokeWalkWeight: parseNumberInput(formData.yokeWalkWeight),
        yokeWalkDistance: parseNumberInput(formData.yokeWalkDistance),
        dipsReps: parseIntInput(formData.dipsReps),
        dipsWeight: parseNumberInput(formData.dipsWeight),
        pullUpsReps: parseIntInput(formData.pullUpsReps),
        pullUpsWeight: parseNumberInput(formData.pullUpsWeight),
        avatarUrl: formData.avatarUrl || undefined,
        gender: formData.gender ? formData.gender as "male" | "female" : undefined,
      });
      setIsEditing(false);
      refetchAthlete();
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  const handleAddLift = async () => {
    if (!athleteId) return;
    try {
      await addLiftMutation.mutateAsync({
        athleteId,
        exerciseType: newLift.exerciseType,
        weight: newLift.weight ? parseFloat(newLift.weight) : undefined,
        reps: newLift.reps ? parseInt(newLift.reps) : undefined,
        distance: newLift.distance ? parseFloat(newLift.distance) : undefined,
        recordedDate: newLift.recordedDate,
      });

      // Also update the main profile PR if this is higher? 
      // The backend should probably handle that or we do it here.
      // For now, let's just refetch.

      setIsAddingLift(false);
      setNewLift({ ...newLift, weight: "", reps: "1", distance: "" });
      refetchLifts();
      refetchAthlete();
    } catch (error) {
      console.error("Failed to add lift:", error);
    }
  };

  const handleAddWeight = async () => {
    if (!athleteId || !formData.bodyWeight) return;
    try {
      await addWeightMutation.mutateAsync({
        athleteId,
        weight: parseFloat(formData.bodyWeight),
        recordedDate: new Date().toISOString().split('T')[0],
      });
      refetchWeight();
    } catch (error) {
      console.error("Failed to add weight entry:", error);
    }
  };

  const handleSetRole = async (userId: number, role: 'user' | 'admin') => {
    try {
      await setUserRoleMutation.mutateAsync({ userId, role });
      toast.success(`User role updated to ${role}`);
      refetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Failed to update role");
    }
  };

  const handleUpdateRequest = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await updateGymRequestMutation.mutateAsync({ id, status });
      toast.success(`Request ${status}`);
      refetchGymRequests();
    } catch (e: any) {
      toast.error(e.message || "Failed to update request");
    }
  };

  const handleGymNameChange = (name: string) => {
    setNewGymName(name);
    // Auto-generate slug
    const slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
    setNewGymSlug(slug);
    // Auto-generate invite code
    const prefix = (name.match(/[A-Z]/g) || name.substring(0, 3).toUpperCase().split('')).slice(0, 3).join('').toUpperCase().padEnd(3, 'X');
    const code = `${prefix}${Math.floor(100 + Math.random() * 899)}`;
    setNewGymCode(code);
  };

  const handleCreateGym = async () => {
    if (!newGymName || !newGymSlug || !newGymCode) return;
    try {
      await createGymMutation.mutateAsync({
        name: newGymName,
        slug: newGymSlug,
        inviteCode: newGymCode,
      });
      toast.success(`Gym "${newGymName}" created successfully!`);
      setNewGymName("");
      setNewGymSlug("");
      setNewGymCode("");
      refetchAthlete();
    } catch (e: any) {
      toast.error(e.message || "Failed to create gym");
    }
  };

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u =>
      u.name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
    );
  }, [allUsers, userSearchTerm]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !athleteId) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${athleteId}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));

      // Auto-save the new avatar URL
      await updateProfileMutation.mutateAsync({
        athleteId,
        avatarUrl: publicUrl
      });

      refetchAthlete();
      toast.success("Profile picture updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload image.");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };
  // PR Video upload handler
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>, exerciseType: string) => {
    const file = e.target.files?.[0];
    if (!file || !athleteId) return;

    // Reset the input so same file can be re-selected
    e.target.value = '';

    // Check file type
    if (!file.type.startsWith('video/')) {
      toast.error("Please select a video file.");
      return;
    }

    // Check file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast.error(`Video is ${(file.size / 1024 / 1024).toFixed(0)}MB — must be under 50MB. Try trimming or recording at a lower quality.`);
      return;
    }

    // Check video duration (40s max)
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(video.src);
          resolve(video.duration);
        };
        video.onerror = () => reject(new Error('Failed to load video'));
        video.src = URL.createObjectURL(file);
      });

      if (duration > 40) {
        toast.error(`Video is ${Math.round(duration)}s — must be 40 seconds or less.`);
        return;
      }
    } catch {
      toast.error("Could not read video duration.");
      return;
    }

    try {
      setUploadingVideo(exerciseType);
      setVideoProgress({ stage: 'Uploading', percent: 0 });

      const fileExt = file.name.split('.').pop();
      const fileName = `${athleteId}/${exerciseType}-${Date.now()}.${fileExt}`;

      const uploadProgressInterval = setInterval(() => {
        setVideoProgress((prev: any) => {
          if (!prev || prev.percent >= 90) return prev;
          return { stage: 'Uploading', percent: Math.min(prev.percent + 5, 90) };
        });
      }, 400);

      const { error: uploadError } = await supabase.storage
        .from('pr-videos')
        .upload(fileName, file, { upsert: true });

      clearInterval(uploadProgressInterval);

      if (uploadError) throw uploadError;

      setVideoProgress({ stage: 'Saving', percent: 95 });

      const { data: { publicUrl } } = supabase.storage
        .from('pr-videos')
        .getPublicUrl(fileName);

      await upsertPrVideoMutation.mutateAsync({
        athleteId,
        exerciseType,
        videoUrl: publicUrl,
      });

      setVideoProgress({ stage: 'Done', percent: 100 });
      refetchPrVideos();
      toast.success(`PR video uploaded for ${exerciseType}!`);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload video.");
      console.error(error);
    } finally {
      setUploadingVideo(null);
      setVideoProgress(null);
    }
  };

  const handleDeleteVideo = async (exerciseType: string) => {
    if (!athleteId) return;
    try {
      await deletePrVideoMutation.mutateAsync({ athleteId, exerciseType });
      refetchPrVideos();
      toast.success("PR video deleted.");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete video.");
    }
  };

  // Sync form data when athlete loads
  useMemo(() => {
    if (athlete) {
      setFormData({
        name: athlete.name || "",
        bodyWeight: athlete.bodyWeight?.toString() || "",
        squat: athlete.squat?.toString() || "",
        bench: athlete.bench?.toString() || "",
        deadlift: athlete.deadlift?.toString() || "",
        ohp: athlete.ohp?.toString() || "",
        farmersWalkWeight: athlete.farmersWalkWeight?.toString() || "",
        farmersWalkDistance: athlete.farmersWalkDistance?.toString() || "",
        yokeWalkWeight: athlete.yokeWalkWeight?.toString() || "",
        yokeWalkDistance: athlete.yokeWalkDistance?.toString() || "",
        dipsReps: athlete.dipsReps?.toString() || "",
        dipsWeight: athlete.dipsWeight?.toString() || "",
        pullUpsReps: athlete.pullUpsReps?.toString() || "",
        pullUpsWeight: athlete.pullUpsWeight?.toString() || "",
        avatarUrl: athlete.avatarUrl || "",
        gender: (athlete.gender as "" | "male" | "female") || "",
      });
    }
  }, [athlete]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to view your profile</p>
          <Button className="btn-dramatic" onClick={() => navigate("/")}>
            Back to Leaderboard
          </Button>
        </div>
      </div>
    );
  }

  if (athleteLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Loading athlete profile...</p>
      </div>
    );
  }

  if (!athleteId || !athlete) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <TrendingUp className="w-16 h-16 text-accent mx-auto mb-6" />
          <h1 className="text-3xl font-bold uppercase mb-4">No Profile Linked</h1>
          <p className="text-muted-foreground mb-8">
            Your account isn't linked to an athlete profile yet. If you're on the leaderboard,
            contact an admin to link your account, or wait for the auto-sync to pick up your name.
          </p>
          <Button className="btn-dramatic w-full" onClick={() => navigate("/")}>
            Back to Leaderboard
          </Button>
        </div>
      </div>
    );
  }

  // Prepare chart data for Lifts
  const liftChartData = (type: string) => {
    return liftHistory
      .filter(l => l.exerciseType.toLowerCase() === type.toLowerCase())
      .map(entry => ({
        date: new Date(entry.recordedDate).toLocaleDateString(),
        weight: entry.weight ? parseFloat(entry.weight) : 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const weightChartData = weightHistory
    .map((entry) => ({
      date: new Date(entry.recordedDate).toLocaleDateString(),
      weight: entry.weight ? parseFloat(entry.weight) : 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Header */}
      <div className="border-b border-border light-ray sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="container py-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-accent hover:text-accent/80 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="uppercase font-bold text-xs tracking-widest">Back</span>
            </button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-accent/30 text-accent hover:bg-accent/10"
                onClick={() => setIsAddingLift(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Lift
              </Button>
              <Button
                size="sm"
                className="btn-dramatic"
                onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              >
                {isEditing ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </>
                ) : (
                  <>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit PRs
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative group">
              <Dialog>
                <DialogTrigger asChild>
                  <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-accent/20 group-hover:border-accent transition-all duration-500 cursor-pointer">
                    <AvatarImage src={athlete.avatarUrl || ""} className="object-cover" />
                    <AvatarFallback className="bg-card text-accent text-3xl font-black">
                      {athlete.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </DialogTrigger>
                <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
                  <VisuallyHidden>
                    <DialogTitle>{athlete.name}'s Profile Picture</DialogTitle>
                  </VisuallyHidden>
                  <img
                    src={athlete.avatarUrl || ""}
                    alt={athlete.name}
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                  />
                </DialogContent>
              </Dialog>
              <label
                htmlFor="pfp-upload"
                className="absolute bottom-0 right-0 bg-accent text-black p-2 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg z-10"
              >
                {uploading ? <div className="w-5 h-5 animate-spin border-2 border-black border-t-transparent rounded-full" /> : <Upload className="w-5 h-5" />}
              </label>
              <input
                id="pfp-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-2">
                {athlete.name}
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full">
                  <MapPin className="w-3 h-3 text-accent" />
                  <span className="text-[10px] uppercase font-black text-accent tracking-widest">
                    {gym ? gym.name : "Global Space"}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-muted/30 border border-border rounded-full">
                  <TrendingUp className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                    {athlete.bodyWeight ? `${athlete.bodyWeight} lbs` : "No BW"}
                  </span>
                </div>
                {athlete.gender && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-muted/30 border border-border rounded-full">
                    <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                      {athlete.gender === "male" ? "🏋️ Male" : "💪 Female"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Squat", value: athlete.squat, key: "squat" },
            { label: "Bench", value: athlete.bench, key: "bench" },
            { label: "Deadlift", value: athlete.deadlift, key: "deadlift" },
            { label: "OHP", value: athlete.ohp, key: "ohp" },
            { label: "Total", value: athlete.total, key: "total" },
          ].map((stat) => {
            const video = prVideos.find((v: any) => v.exerciseType === stat.key);
            const isOwner = user?.athleteId === athleteId;
            return (
              <Card key={stat.label} className="card-dramatic p-4 text-center border-accent/20 relative group">
                <div className="text-xl md:text-2xl font-bold text-accent">
                  {stat.value ? `${stat.value}` : "—"}
                </div>
                <div className="text-[10px] md:text-xs text-muted-foreground uppercase font-black tracking-widest mt-1">
                  {stat.label}
                </div>
                {/* Video buttons */}
                <div className="flex items-center justify-center gap-1 mt-2">
                  {video && isAuthenticated && (
                    <button
                      onClick={() => setPlayingVideo({ exercise: stat.label, url: video.videoUrl })}
                      className="flex items-center gap-1 px-2 py-1 bg-accent/10 hover:bg-accent/20 rounded text-[10px] text-accent font-bold uppercase tracking-wider transition-all"
                    >
                      <Play className="w-3 h-3" /> Watch
                    </button>
                  )}
                  {isOwner && (
                    <label className="flex items-center gap-1 px-2 py-1 bg-muted/30 hover:bg-muted/50 rounded text-[10px] text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider transition-all cursor-pointer">
                      <Video className="w-3 h-3" />
                      {uploadingVideo === stat.key ? "..." : video ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => handleVideoUpload(e, stat.key)}
                        disabled={uploadingVideo !== null}
                      />
                    </label>
                  )}
                  {(isOwner || user?.role === 'admin') && video && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          const currentJudges = allJudgments
                            .filter(j => j.athleteId === athleteId && j.exerciseType === stat.key)
                            .map(j => j.judgeId);
                          setTempJudgeIds(currentJudges);
                          setSelectingJudges(stat.key);
                        }}
                        className="p-1 bg-accent/10 hover:bg-accent/20 rounded text-accent transition-all"
                        title="Select Judges"
                      >
                        <Users className="w-3 h-3" />
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => handleDeleteVideo(stat.key)}
                          className="p-1 bg-red-500/10 hover:bg-red-500/20 rounded text-red-400 transition-all"
                          title="Delete video"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Judgment Status UI */}
                {video && (
                  <div className="mt-2 flex items-center justify-between px-1">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => {
                        const videoJudgments = allJudgments.filter(j => j.athleteId === athleteId && j.exerciseType === stat.key);
                        const judgment = videoJudgments[i];
                        if (!judgment) return <div key={i} className="w-3 h-3 rounded-full border border-muted-foreground/30" />;
                        return (
                          <div 
                            key={i} 
                            className={`w-3 h-3 rounded-full border shadow-sm ${
                              judgment.vote === 'white' ? 'bg-white border-white shadow-white/50' : 
                              judgment.vote === 'red' ? 'bg-red-600 border-red-600 shadow-red-600/50' : 
                              'bg-transparent border-muted-foreground/50'
                            }`}
                            title={judgment.vote ? `${judgment.vote === 'white' ? 'Good Lift' : 'No Lift'}` : 'Pending Judge'}
                          />
                        );
                      })}
                    </div>
                    {allJudgments.filter(j => j.athleteId === athleteId && j.exerciseType === stat.key && j.vote === 'white').length >= 2 && (
                      <span className="text-[10px] font-black text-white bg-green-600 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(22,163,74,0.5)] animate-pulse">
                        APPROVED
                      </span>
                    )}
                  </div>
                )}

                {/* Progress Bar UI */}
                {uploadingVideo === stat.key && videoProgress && (
                  <div className="mt-3 px-2">
                    <div className="flex justify-between items-center text-[8px] uppercase font-black text-accent mb-1">
                      <span>{videoProgress.stage}</span>
                      <span>{videoProgress.percent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-accent/10 rounded-full overflow-hidden border border-accent/20">
                      <div
                        className="h-full bg-accent transition-all duration-300 ease-out shadow-[0_0_8px_rgba(216,180,105,0.5)]"
                        style={{ width: `${videoProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Video Playback Dialog */}
        <Dialog open={!!playingVideo} onOpenChange={(open) => !open && setPlayingVideo(null)}>
          <DialogContent className="sm:max-w-2xl bg-black border-accent/30">
            <DialogTitle className="text-accent uppercase font-black tracking-widest text-sm">
              {playingVideo?.exercise} PR Video
            </DialogTitle>
            {playingVideo && (
              <video
                src={playingVideo.url}
                controls
                autoPlay
                className="w-full rounded-lg max-h-[70vh]"
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Add Lift Overlay/Modal-like Card */}
        {isAddingLift && (
          <Card className="card-dramatic mb-8 border-accent border-2 bg-black/90">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold uppercase flex items-center gap-2">
                <Plus className="w-5 h-5 text-accent" />
                Record New Lift
              </h2>
              <button onClick={() => setIsAddingLift(false)} className="text-muted-foreground hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-accent uppercase font-bold text-[10px] mb-2 block">Exercise</Label>
                <select
                  className="w-full bg-input border border-border p-2 rounded-md text-foreground"
                  value={newLift.exerciseType}
                  onChange={(e) => setNewLift({ ...newLift, exerciseType: e.target.value })}
                >
                  <option value="squat">Squat</option>
                  <option value="bench">Bench</option>
                  <option value="deadlift">Deadlift</option>
                  <option value="ohp">OHP</option>
                  <option value="farmersWalk">Farmers Walk</option>
                  <option value="yokeWalk">Yoke Walk</option>
                  <option value="dips">Dips</option>
                  <option value="pullUps">Pull Ups</option>
                </select>
              </div>
              {['farmersWalk', 'yokeWalk'].includes(newLift.exerciseType) ? (
                <>
                  <div>
                    <Label className="text-accent uppercase font-bold text-[10px] mb-2 block">Weight (lbs)</Label>
                    <Input type="number" value={newLift.weight} onChange={(e) => setNewLift({ ...newLift, weight: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-accent uppercase font-bold text-[10px] mb-2 block">Distance (m)</Label>
                    <Input type="number" value={newLift.distance} onChange={(e) => setNewLift({ ...newLift, distance: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-accent uppercase font-bold text-[10px] mb-2 block">Weight (lbs)</Label>
                    <Input type="number" value={newLift.weight} onChange={(e) => setNewLift({ ...newLift, weight: e.target.value })} placeholder={['dips', 'pullUps'].includes(newLift.exerciseType) ? "Bodyweight or Added" : ""} />
                  </div>
                  <div>
                    <Label className="text-accent uppercase font-bold text-[10px] mb-2 block">Reps</Label>
                    <Input type="number" value={newLift.reps} onChange={(e) => setNewLift({ ...newLift, reps: e.target.value })} />
                  </div>
                </>
              )}
              <div className="flex items-end">
                <Button className="btn-dramatic w-full" onClick={handleAddLift} disabled={!newLift.weight && !newLift.distance && !newLift.reps}>
                  Add Entry
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Edit PRs Form */}
        {isEditing && (
          <Card className="card-dramatic mb-8 border-accent/40">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold uppercase">Update Personal Records</h2>
              <button onClick={() => setIsEditing(false)} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label className="text-accent uppercase font-bold text-[10px] mb-1 block">Full Name</Label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <Label className="text-accent uppercase font-bold text-[10px] mb-1 block">Gender</Label>
                  <div className="flex bg-card/50 border border-border rounded-lg p-1 h-12">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, gender: "male" })}
                      className={`flex-1 rounded-md text-xs font-black uppercase tracking-wider transition-all duration-200 ${formData.gender === "male"
                        ? "bg-accent text-black shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      🏋️ Male
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, gender: "female" })}
                      className={`flex-1 rounded-md text-xs font-black uppercase tracking-wider transition-all duration-200 ${formData.gender === "female"
                        ? "bg-accent text-black shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      💪 Female
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: "BW", key: "bodyWeight" },
                  { label: "Squat", key: "squat" },
                  { label: "Bench", key: "bench" },
                  { label: "DL", key: "deadlift" },
                  { label: "OHP", key: "ohp" },
                  { label: "F.Walk(W)", key: "farmersWalkWeight" },
                  { label: "F.Walk(D)", key: "farmersWalkDistance" },
                  { label: "Y.Walk(W)", key: "yokeWalkWeight" },
                  { label: "Y.Walk(D)", key: "yokeWalkDistance" },
                  { label: "Dips(W)", key: "dipsWeight" },
                  { label: "Dips(R)", key: "dipsReps" },
                  { label: "P.Ups(W)", key: "pullUpsWeight" },
                  { label: "P.Ups(R)", key: "pullUpsReps" },
                ].map((field) => (
                  <div key={field.key}>
                    <Label className="text-accent uppercase font-bold text-[10px] mb-1 block">{field.label}</Label>
                    <Input
                      type="number"
                      value={formData[field.key as keyof typeof formData]}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button className="btn-dramatic flex-1" onClick={handleSave}>Save PRs</Button>
              <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-1">
            <Card className="card-dramatic p-6 h-full">
              <h3 className="text-xs uppercase font-black text-accent tracking-widest mb-6">Your Gym Space</h3>
              {(gym && !isChangingGym) ? (
                <div className="space-y-6">
                  <div className="p-4 bg-accent/5 border-2 border-accent/20 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Affiliated With</p>
                    <p className="text-xl font-black uppercase italic text-accent">{gym.name}</p>
                    <div className="mt-4 pt-4 border-t border-accent/10">
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-2">Share Invite Code</p>
                      <div className="bg-black/40 p-3 rounded font-mono font-black text-center border border-accent/10 select-all cursor-pointer">
                        {gym.inviteCode}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 uppercase font-black text-[10px] border-accent/20 text-accent hover:bg-accent/10"
                      onClick={() => setIsChangingGym(true)}
                    >
                      Change Gym
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 uppercase font-black text-[10px] text-destructive hover:bg-destructive/10"
                      onClick={handleLeaveGym}
                    >
                      Leave
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-bold uppercase italic leading-relaxed">
                      {isChangingGym ? "Join a new gym space" : "You are currently a solo lifter. Join a gym space to compete with your team."}
                    </p>
                    {isChangingGym && (
                      <button onClick={() => setIsChangingGym(false)} className="text-muted-foreground hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase font-black text-accent tracking-widest block">Invite Code</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="CODE123"
                        value={gymInviteCode}
                        onChange={(e) => setGymInviteCode(e.target.value.toUpperCase())}
                        className="bg-card/50 border-border uppercase font-black h-12"
                      />
                      <Button
                        className="btn-dramatic px-6 h-12 font-black uppercase"
                        onClick={handleJoinGym}
                        disabled={!gymInviteCode || joinGymMutation.isPending}
                      >
                        Join
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2">
            {/* Quick Stats Grid can go here if we want or just let it stay above */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Squat", value: athlete.squat },
                { label: "Bench", value: athlete.bench },
                { label: "Deadlift", value: athlete.deadlift },
                { label: "Total", value: athlete.total },
              ].map((stat) => (
                <Card key={stat.label} className="card-dramatic p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">{stat.label}</p>
                  <p className="text-2xl font-black text-accent">{stat.value || "0"}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Charts & History */}
        <Tabs defaultValue="charts" className="mb-12">
          <TabsList className="bg-card border border-border mb-6">
            <TabsTrigger value="charts" className="data-[state=active]:bg-accent data-[state=active]:text-black">
              Progress Visuals
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-accent data-[state=active]:text-black">
              Full History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="charts" className="space-y-8 mt-0">
            {/* Dynamic Lifts Logic */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {['squat', 'bench', 'deadlift', 'ohp'].map(type => {
                const data = liftChartData(type);
                if (data.length < 2) return null;
                return (
                  <Card key={type} className="card-dramatic p-6">
                    <h3 className="text-lg font-bold uppercase text-accent mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      {type} History
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(216, 180, 105, 0.05)" />
                        <XAxis dataKey="date" hide />
                        <YAxis stroke="rgba(216, 180, 105, 0.4)" domain={['dataMin - 10', 'dataMax + 10']} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#000", border: "1px solid #d8b469" }}
                          labelStyle={{ color: "#d8b469" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="#d8b469"
                          strokeWidth={3}
                          dot={{ fill: "#d8b469", r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                );
              })}

              {/* Body Weight Chart */}
              {weightChartData.length >= 2 && (
                <Card className="card-dramatic p-6">
                  <h3 className="text-lg font-bold uppercase text-accent mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Weight Progress
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={weightChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(216, 180, 105, 0.05)" />
                      <XAxis dataKey="date" hide />
                      <YAxis stroke="rgba(216, 180, 105, 0.4)" domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#000", border: "1px solid #d8b469" }}
                        labelStyle={{ color: "#d8b469" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#d8b469"
                        strokeWidth={2}
                        dot={{ fill: "#d8b469", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>

            {(liftHistory.length < 2 && weightHistory.length < 2) && (
              <Card className="card-dramatic p-12 text-center border-dashed border-accent/20">
                <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground italic">Add more entries to see your progress trends</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card className="card-dramatic overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-accent/5">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black uppercase text-accent tracking-widest">Exercise</th>
                      <th className="px-6 py-4 text-right text-xs font-black uppercase text-accent tracking-widest">Weight</th>
                      <th className="px-6 py-4 text-right text-xs font-black uppercase text-accent tracking-widest">Reps</th>
                      <th className="px-6 py-4 text-right text-xs font-black uppercase text-accent tracking-widest">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {liftHistory.sort((a, b) => new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime()).map((lift) => (
                      <tr key={lift.id} className="hover:bg-accent/5 transition-colors">
                        <td className="px-6 py-4 font-bold uppercase text-sm">{lift.exerciseType}</td>
                        <td className="px-6 py-4 text-right text-accent font-black">{lift.weight} <span className="text-[10px] text-muted-foreground">LBS</span></td>
                        <td className="px-6 py-4 text-right font-medium">{lift.reps}</td>
                        <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                          {new Date(lift.recordedDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {liftHistory.length === 0 && (
                <div className="p-12 text-center text-muted-foreground italic">No lift entries yet.</div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {user?.role === 'admin' && (
          <div className="mt-12 pt-12 border-t border-border animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h2 className="text-2xl font-black uppercase mb-8 flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-accent" />
              Admin Portal
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="card-dramatic p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-accent">User Management</h3>
                  <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-accent" />
                    <Input
                      placeholder="Find athletes..."
                      className="pl-9 h-8 text-[10px] bg-card/50 border-accent/10 focus:border-accent/40"
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-3 bg-accent/5 border border-accent/10 rounded-lg hover:border-accent/30 transition-all">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 border border-accent/20">
                          <AvatarFallback className="text-[10px] font-black uppercase">{u.name?.charAt(0) || "?"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold uppercase text-xs">{u.name || "Anonymous"}</p>
                          <p className="text-[8px] text-muted-foreground lowercase">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-accent text-black' : 'bg-muted/50 text-muted-foreground'}`}>
                          {u.role}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[8px] uppercase font-black px-2 border-accent/20 hover:bg-accent hover:text-black transition-all"
                          onClick={() => handleSetRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                          disabled={u.id === user.id}
                        >
                          {u.role === 'admin' ? "Demote" : "Promote"}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground italic py-8">No users found.</p>
                  )}
                </div>
              </Card>

              <Card className="card-dramatic p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-accent mb-6">Gym Addition Requests</h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {gymRequests.map(req => (
                    <div key={req.id} className="p-3 bg-accent/5 border border-accent/10 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold uppercase text-xs">{req.name}</p>
                          <p className="text-[8px] text-muted-foreground">Requested {new Date(req.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${req.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                          req.status === 'rejected' ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'
                          }`}>
                          {req.status}
                        </span>
                      </div>
                      {req.status === 'pending' && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            className="h-7 text-[8px] uppercase font-black bg-green-600 hover:bg-green-700 text-white transition-all flex-1"
                            onClick={() => handleUpdateRequest(req.id, 'approved')}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[8px] uppercase font-black border-red-500/50 text-red-500 hover:bg-red-500/10 transition-all flex-1"
                            onClick={() => handleUpdateRequest(req.id, 'rejected')}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {gymRequests.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground italic py-8">No gym requests.</p>
                  )}
                </div>
              </Card>

              <Card className="card-dramatic p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-accent mb-6">Create New Gym</h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-2 block">Gym Name</Label>
                    <Input
                      placeholder="e.g. Iron Paradise"
                      value={newGymName}
                      onChange={(e) => handleGymNameChange(e.target.value)}
                      className="bg-card/50 border-border h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-2 block">Slug (URL-friendly)</Label>
                    <Input
                      placeholder="e.g. iron-paradise"
                      value={newGymSlug}
                      onChange={(e) => setNewGymSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      className="bg-card/50 border-border h-10 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-2 block">Invite Code</Label>
                    <Input
                      placeholder="e.g. IRON123"
                      value={newGymCode}
                      onChange={(e) => setNewGymCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      maxLength={12}
                      className="bg-card/50 border-border h-10 font-mono text-xs uppercase"
                    />
                  </div>
                  <Button
                    className="btn-dramatic w-full h-10 uppercase font-black"
                    onClick={handleCreateGym}
                    disabled={!newGymName || !newGymSlug || !newGymCode || createGymMutation.isPending}
                  >
                    {createGymMutation.isPending ? "Creating..." : "Create Gym"}
                  </Button>
                </div>
              </Card>

              <div className="lg:col-span-2">
                <Card className="card-dramatic p-6 relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                    <ShieldCheck className="w-32 h-32" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-accent mb-6">System Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground leading-relaxed italic">
                        Use this portal to manage the strength community. Promote dedicated lifters and review gym requests.
                      </p>
                    </div>
                    <div className="p-4 bg-black/40 border border-accent/10 rounded-lg">
                      <p className="text-[10px] text-accent font-black uppercase mb-1">Session</p>
                      <p className="text-[10px] text-muted-foreground tracking-tighter">System Version: 1.0.2-admin</p>
                      <p className="text-[10px] text-muted-foreground tracking-tighter">Connected as: {user.name}</p>
                    </div>
                    <div className="p-4 bg-black/40 border border-accent/10 rounded-lg flex items-center justify-center">
                      <ShieldCheck className="w-8 h-8 text-accent animate-pulse" />
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Judge Selection Dialog */}
      <Dialog open={!!selectingJudges} onOpenChange={(open) => !open && setSelectingJudges(null)}>
        <DialogContent className="sm:max-w-md bg-black border-accent/30">
          <DialogHeader>
            <DialogTitle className="text-accent uppercase font-black tracking-widest">
              Assign Judges for {exercises.find(e => e.id === selectingJudges)?.label}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Select exactly 3 members to judge this lift.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="text-xs text-muted-foreground mb-4 font-bold uppercase tracking-wider flex justify-between">
              <span>Community Members</span>
              <span className={tempJudgeIds.length === 3 ? "text-accent" : "text-red-500"}>
                {tempJudgeIds.length} / 3 Selected
              </span>
            </div>
            
            <ScrollArea className="h-64 rounded border border-muted/20 p-2">
              <div className="space-y-2">
                {communityUsers
                  .filter(u => u.id !== user?.id) // Can't judge yourself
                  .map(u => (
                    <div 
                      key={u.id} 
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-all ${
                        tempJudgeIds.includes(u.id) ? 'bg-accent/10 border border-accent/30' : 'hover:bg-muted/10 border border-transparent'
                      }`}
                      onClick={() => {
                        if (tempJudgeIds.includes(u.id)) {
                          setTempJudgeIds(prev => prev.filter(id => id !== u.id));
                        } else if (tempJudgeIds.length < 3) {
                          setTempJudgeIds(prev => [...prev, u.id]);
                        }
                      }}
                    >
                      <Checkbox 
                        checked={tempJudgeIds.includes(u.id)}
                        onCheckedChange={() => {}} // Handled by div click
                        className="border-accent/50 data-[state=checked]:bg-accent data-[state=checked]:text-black"
                      />
                      <Avatar className="w-8 h-8 border border-muted/50">
                        <AvatarImage src={communityUsers.find(au => au.id === u.id)?.athleteId ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}` : undefined} />
                        <AvatarFallback className="text-[10px] bg-muted/50">{u.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground">{u.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{u.role}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setSelectingJudges(null)}
              className="flex-1 uppercase font-black text-xs"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAssignJudges}
              disabled={tempJudgeIds.length !== 3 || assignJudgesMutation.isPending}
              className="flex-1 bg-accent text-black hover:bg-accent/90 uppercase font-black text-xs shadow-[0_0_15px_rgba(216,180,105,0.4)]"
            >
              {assignJudgesMutation.isPending ? "Assigning..." : "Confirm Judges"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Playback & Judging Dialog */}
      <Dialog open={!!playingVideo} onOpenChange={(open) => !open && setPlayingVideo(null)}>
        <DialogContent className="sm:max-w-2xl bg-black border-accent/30 p-3 sm:p-6">
          <DialogTitle className="text-accent uppercase font-black tracking-widest text-xs sm:text-sm mb-4">
            {athlete?.name} — {playingVideo?.exercise} PR
          </DialogTitle>
          {playingVideo && (
            <div className="space-y-6">
              <video
                src={playingVideo.url}
                controls
                autoPlay
                className="w-full aspect-video rounded-lg shadow-[0_0_30px_rgba(216,180,105,0.2)] border border-accent/20"
              />
              
              {/* Judging Interface inside Dialog */}
              <div className="bg-accent/5 border border-accent/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-accent">Official Judging</h4>
                  <div className="flex gap-2">
                    {[0, 1, 2].map((i) => {
                      const exType = exercises.find(e => e.label === playingVideo.exercise)?.id || "";
                      const videoJudgments = allJudgments.filter(j => j.athleteId === athleteId && j.exerciseType === exType);
                      const judgment = videoJudgments[i];
                      return (
                        <div 
                          key={i} 
                          className={`w-4 h-4 rounded-full border shadow-sm ${
                            judgment?.vote === 'white' ? 'bg-white border-white' : 
                            judgment?.vote === 'red' ? 'bg-red-600 border-red-600' : 
                            'bg-transparent border-muted-foreground/30'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Voting Buttons for assigned judge */}
                {(() => {
                  const exType = exercises.find(e => e.label === playingVideo.exercise)?.id || "";
                  const myJudgment = allJudgments.find(j => 
                    j.athleteId === athleteId && 
                    j.exerciseType === exType && 
                    j.judgeId === user?.id
                  );

                  if (!myJudgment) return (
                    <p className="text-[10px] text-muted-foreground italic text-center py-2">
                      You are not assigned as a judge for this lift.
                    </p>
                  );

                  return (
                    <div className="flex gap-3">
                      <Button
                        onClick={() => submitVoteMutation.mutate({ athleteId: athleteId!, exerciseType: exType, vote: 'white' })}
                        disabled={submitVoteMutation.isPending || myJudgment.vote === 'white'}
                        className={`flex-1 h-12 rounded-lg font-black uppercase tracking-widest transition-all ${
                          myJudgment.vote === 'white' ? 'bg-white text-black border-white' : 'bg-transparent border-white text-white hover:bg-white hover:text-black'
                        } border-2`}
                      >
                        White Light
                      </Button>
                      <Button
                        onClick={() => submitVoteMutation.mutate({ athleteId: athleteId!, exerciseType: exType, vote: 'red' })}
                        disabled={submitVoteMutation.isPending || myJudgment.vote === 'red'}
                        className={`flex-1 h-12 rounded-lg font-black uppercase tracking-widest transition-all ${
                          myJudgment.vote === 'red' ? 'bg-red-600 text-white border-red-600' : 'bg-transparent border-red-600 text-red-600 hover:bg-red-600 hover:text-white'
                        } border-2`}
                      >
                        Red Light
                      </Button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

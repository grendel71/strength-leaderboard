import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Trophy, LogIn, LogOut, ArrowUpDown, MapPin, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
// getLoginUrl removed

type ExerciseId =
  | "total"
  | "squat"
  | "bench"
  | "deadlift"
  | "ohp"
  | "farmersWalk"
  | "yokeWalk"
  | "dips"
  | "pullUps";

type PrVideo = {
  athleteId: number;
  exerciseType: string;
  videoUrl: string;
};

type RecentPrVideo = PrVideo & {
  id: number;
  athleteName: string;
  avatarUrl: string | null;
  createdAt: Date | string;
};

type LeaderboardView = "male" | "female" | "recent";

export default function Leaderboard() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const [sortBy, setSortBy] = useState<ExerciseId>("total");
  const [leaderboardView, setLeaderboardView] = useState<LeaderboardView>("male");
  const [selectedGymId, setSelectedGymId] = useState<number | undefined>(undefined);
  const [hasSetInitialGym, setHasSetInitialGym] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<{ athleteId: number; name: string; url: string; exercise: string } | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const genderFilter = leaderboardView === "female" ? "female" : "male";

  const { data: gyms = [] } = trpc.gym.getAll.useQuery();
  const { data: athletes = [], isLoading } = trpc.leaderboard.getByExercise.useQuery({
    exercise: sortBy,
    gymId: selectedGymId,
    gender: genderFilter,
  });

  // Fetch ALL PR videos for the leaderboard
  const { data: allPrVideos = [] } = trpc.athlete.getAllPrVideos.useQuery();
  const { data: recentPrVideos = [] } = trpc.athlete.getRecentPrVideos.useQuery({ limit: 50 });
  const athleteVideoMap = useMemo(() => {
    const map = new Map<number, PrVideo[]>();
    allPrVideos.forEach((video: PrVideo) => {
      if (!map.has(video.athleteId)) map.set(video.athleteId, []);
      map.get(video.athleteId)!.push(video);
    });
    return map;
  }, [allPrVideos]);

  const { data: athlete } = trpc.athlete.getById.useQuery(
    { id: (user as any)?.athleteId || 0 },
    { enabled: !!(user as any)?.athleteId && !hasSetInitialGym }
  );

  const { data: allJudgments = [], refetch: refetchJudgments } = trpc.athlete.getAllPrVideoJudgments.useQuery();
  const { data: allComments = [], refetch: refetchComments } = trpc.athlete.getAllPrVideoComments.useQuery();
  const submitVoteMutation = trpc.athlete.submitPrVideoVote.useMutation({
    onSuccess: () => {
      refetchJudgments();
    }
  });
  const addCommentMutation = trpc.athlete.addPrVideoComment.useMutation({
    onSuccess: () => {
      setCommentDraft("");
      refetchComments();
    },
  });

  useEffect(() => {
    if (athlete && !hasSetInitialGym) {
      if (athlete.gymId) {
        setSelectedGymId(athlete.gymId);
      }
      setHasSetInitialGym(true);
    }
  }, [athlete, hasSetInitialGym]);

  const exercises = [
    { id: "total", label: "Total", icon: "🏆" },
    { id: "squat", label: "Squat", icon: "🦵" },
    { id: "bench", label: "Bench", icon: "💪" },
    { id: "deadlift", label: "Deadlift", icon: "🔥" },
    { id: "ohp", label: "OHP", icon: "⬆️" },
    { id: "farmersWalk", label: "Farmers", icon: "🚜" },
    { id: "yokeWalk", label: "Yoke", icon: "🐂" },
    { id: "dips", label: "Dips", icon: "📉" },
    { id: "pullUps", label: "Pull Ups", icon: "🦾" },
  ];

  const getExerciseLabel = (exerciseType: string) => exercises.find((exercise) => exercise.id === exerciseType)?.label || exerciseType;
  const getAthleteVideos = (athleteId: number) =>
    [...(athleteVideoMap.get(athleteId) ?? [])].sort(
      (left, right) =>
        exercises.findIndex((exercise) => exercise.id === left.exerciseType) -
        exercises.findIndex((exercise) => exercise.id === right.exerciseType)
    );
  const getVideoJudgments = (athleteId: number, exerciseType: string) =>
    allJudgments.filter((judgment) => judgment.athleteId === athleteId && judgment.exerciseType === exerciseType);
  const getVideoComments = (athleteId: number, exerciseType: string) =>
    allComments.filter((comment) => comment.athleteId === athleteId && comment.exerciseType === exerciseType);
  const formatUploadTime = (createdAt: Date | string) => {
    const uploadTime = new Date(createdAt).getTime();
    const diffSeconds = Math.max(1, Math.floor((Date.now() - uploadTime) / 1000));
    if (diffSeconds < 60) return "Just now";

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return diffDays < 7 ? `${diffDays}d ago` : new Date(createdAt).toLocaleDateString();
  };
  const openVideo = (athleteId: number, athleteName: string, video: PrVideo) => {
    setPlayingVideo({
      athleteId,
      name: athleteName,
      url: video.videoUrl,
      exercise: video.exerciseType,
    });
  };
  const submitComment = () => {
    if (!playingVideo) return;
    const comment = commentDraft.trim();
    if (!comment) return;

    addCommentMutation.mutate({
      athleteId: playingVideo.athleteId,
      exerciseType: playingVideo.exercise,
      comment,
    });
  };
  const renderJudgmentStatus = (athleteId: number, exerciseType: string, variant: "mobile" | "desktop") => {
    const videoJudgments = getVideoJudgments(athleteId, exerciseType);
    if (videoJudgments.length === 0) return null;

    const isApproved = videoJudgments.filter((judgment) => judgment.vote === "white").length >= 2;

    if (variant === "mobile") {
      return (
        <div className="mt-2 flex items-center justify-between px-1">
          <div className="flex gap-1">
            {[0, 1, 2].map((index) => {
              const judgment = videoJudgments[index];
              return (
                <div
                  key={index}
                  className={`w-2.5 h-2.5 rounded-full border ${
                    judgment?.vote === "white"
                      ? "bg-white border-white"
                      : judgment?.vote === "red"
                        ? "bg-red-600 border-red-600"
                        : "bg-transparent border-muted-foreground/30"
                  }`}
                />
              );
            })}
          </div>
          {isApproved && (
            <span className="text-[9px] font-black text-white bg-green-600 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(22,163,74,0.4)]">
              APPROVED
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
          {[0, 1, 2].map((index) => {
            const judgment = videoJudgments[index];
            return (
              <div
                key={index}
                className={`w-2 h-2 rounded-full border ${
                  judgment?.vote === "white"
                    ? "bg-white border-white"
                    : judgment?.vote === "red"
                      ? "bg-red-600 border-red-600"
                      : "bg-transparent border-muted-foreground/20"
                }`}
              />
            );
          })}
        </div>
        {isApproved && (
          <span className="text-[8px] font-black text-green-500 uppercase tracking-tighter">
            Approved
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 md:pb-0">
      {/* Header with dramatic gradient */}
      <div className="relative overflow-hidden border-b border-border light-ray">
        <div className="container py-6 md:py-12 lg:py-16 relative z-10">
          <div className="flex flex-col gap-4 md:gap-6">
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-wider mb-2">
                Strength Leaderboard
              </h1>
              <p className="text-muted-foreground text-sm md:text-lg uppercase font-bold tracking-widest italic flex items-center gap-2">
                {leaderboardView === "recent"
                  ? "Latest PR video uploads"
                  : selectedGymId
                  ? gyms.find(g => g.id === selectedGymId)?.name
                  : "Global Rankings"}
                <MapPin className="w-3 h-3 md:w-4 md:h-4 text-accent" />
              </p>
            </div>

            {/* Mobile-optimized controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              {leaderboardView !== "recent" && (
              <Select
                value={selectedGymId?.toString() || "global"}
                onValueChange={(val: string) => setSelectedGymId(val === "global" ? undefined : parseInt(val))}
              >
                <SelectTrigger className="w-full sm:w-[200px] bg-card/50 border-accent/20 font-bold uppercase text-xs h-11 md:h-10">
                  <SelectValue placeholder="Select Space" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="global" className="font-bold uppercase text-xs">🌍 Global Leaderboard</SelectItem>
                  {gyms.map(gym => (
                    <SelectItem key={gym.id} value={gym.id.toString()} className="font-bold uppercase text-xs">
                      🏟️ {gym.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              )}

              {/* View Toggle */}
              <div className="flex bg-card/50 border border-accent/20 rounded-lg p-1 h-11 md:h-10">
                <button
                  onClick={() => setLeaderboardView("male")}
                  className={`flex-1 px-3 sm:px-4 rounded-md text-xs font-black uppercase tracking-wider transition-all duration-200 ${leaderboardView === "male"
                      ? "bg-accent text-black shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  🏋️ Men
                </button>
                <button
                  onClick={() => setLeaderboardView("female")}
                  className={`flex-1 px-3 sm:px-4 rounded-md text-xs font-black uppercase tracking-wider transition-all duration-200 ${leaderboardView === "female"
                      ? "bg-accent text-black shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  💪 Women
                </button>
                <button
                  onClick={() => setLeaderboardView("recent")}
                  className={`flex-1 px-3 sm:px-4 rounded-md text-xs font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${leaderboardView === "recent"
                      ? "bg-accent text-black shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  Recent Uploads
                </button>
              </div>

              <div className="flex gap-2 sm:gap-3 flex-1 sm:flex-initial">
                {loading ? null : isAuthenticated ? (
                  <>
                    <Link href="/profile" className="flex-1 sm:flex-initial">
                      <Button className="btn-dramatic w-full h-11 md:h-10">
                        My Profile
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => logout()}
                      className="uppercase font-bold h-11 md:h-10 px-3 sm:px-4"
                    >
                      <LogOut className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Logout</span>
                    </Button>
                  </>
                ) : (
                  <Link href="/auth" className="flex-1 sm:flex-initial">
                    <Button className="btn-dramatic text-white w-full h-11 md:h-10">
                      <LogIn className="w-4 h-4 mr-2" />
                      Login
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container py-12">
        {leaderboardView === "recent" ? (
          <section className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-accent mb-1">
                  Fresh Uploads
                </p>
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                  Recent PR Feed
                </h2>
              </div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                New lift videos from the community
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentPrVideos.map((video: RecentPrVideo) => (
                <Card
                  key={video.id}
                  className="group relative overflow-hidden border-accent/15 bg-card/80 p-4 hover:border-accent/40 transition-all"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent/10 via-accent to-accent/10 opacity-70" />
                  <div className="flex items-center gap-3 mb-4">
                    <Link href={`/athlete/${video.athleteId}`}>
                      <Avatar className="w-10 h-10 border border-accent/25 cursor-pointer group-hover:scale-105 transition-transform">
                        <AvatarImage src={video.avatarUrl || ""} className="object-cover" />
                        <AvatarFallback className="bg-muted text-xs font-black">
                          {video.athleteName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="min-w-0">
                      <Link href={`/athlete/${video.athleteId}`}>
                        <h3 className="font-black text-sm uppercase truncate hover:text-accent transition-colors">
                          {video.athleteName}
                        </h3>
                      </Link>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">
                        {formatUploadTime(video.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Uploaded</div>
                      <div className="text-lg font-black text-accent uppercase">
                        {getExerciseLabel(video.exerciseType)} PR
                      </div>
                    </div>
                    <Button
                      onClick={() => openVideo(video.athleteId, video.athleteName, video)}
                      size="sm"
                      className="bg-accent text-black hover:bg-accent/90 font-black uppercase"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      Watch
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : (
          <>

        {/* Exercise tabs */}
        <div className="mb-8">
          <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as any)} className="w-full">
            <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-2 bg-card border border-border p-2 rounded-lg h-auto">
              {exercises.map((ex) => (
                <TabsTrigger
                  key={ex.id}
                  value={ex.id}
                  className="uppercase font-bold text-[10px] sm:text-xs data-[state=active]:bg-accent data-[state=active]:text-accent-foreground py-1 px-2"
                >
                  <span className="mr-1">{ex.icon}</span>
                  <span className="truncate">{ex.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Leaderboard table */}
        <div className="card-dramatic overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin mb-4">
                  <Trophy className="w-12 h-12 text-accent" />
                </div>
                <p className="text-muted-foreground">Loading leaderboard...</p>
              </div>
            </div>
          ) : athletes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No athletes found</p>
              {isAuthenticated && (
                <Link href="/profile">
                  <Button className="btn-dramatic">Add Your Lifts</Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 p-4">
                {athletes.map((athlete, idx) => (
                  <Card key={athlete.id} className="p-4 hover:bg-card/50 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-shrink-0">
                        {idx === 0 && <span className="text-2xl">🥇</span>}
                        {idx === 1 && <span className="text-2xl">🥈</span>}
                        {idx === 2 && <span className="text-2xl">🥉</span>}
                        {idx >= 3 && (
                          <span className="text-sm font-black text-muted-foreground/50">#{idx + 1}</span>
                        )}
                      </div>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Avatar className="w-14 h-14 border-2 border-accent/20 cursor-pointer active:scale-95 transition-transform">
                            <AvatarImage src={athlete.avatarUrl || ""} className="object-cover" />
                            <AvatarFallback className="bg-muted text-sm font-black">{athlete.name.charAt(0)}</AvatarFallback>
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

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground truncate">{athlete.name}</h3>
                        <p className="text-xs text-muted-foreground">BW: {athlete.bodyWeight || "—"} lbs</p>
                      </div>

                      <Link href={`/athlete/${athlete.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[10px] uppercase font-black hover:bg-accent hover:text-black transition-all h-8 px-3"
                        >
                          View
                        </Button>
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className={`p-2 rounded ${sortBy === 'squat' ? 'bg-accent/10 border border-accent/20' : 'bg-muted/30'}`}>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Squat</div>
                        <div className={`font-bold ${sortBy === 'squat' ? 'text-accent' : 'text-foreground'}`}>
                          {athlete.squat || "—"}
                        </div>
                      </div>
                      <div className={`p-2 rounded ${sortBy === 'bench' ? 'bg-accent/10 border border-accent/20' : 'bg-muted/30'}`}>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Bench</div>
                        <div className={`font-bold ${sortBy === 'bench' ? 'text-accent' : 'text-foreground'}`}>
                          {athlete.bench || "—"}
                        </div>
                      </div>
                      <div className={`p-2 rounded ${sortBy === 'deadlift' ? 'bg-accent/10 border border-accent/20' : 'bg-muted/30'}`}>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Deadlift</div>
                        <div className={`font-bold ${sortBy === 'deadlift' ? 'text-accent' : 'text-foreground'}`}>
                          {athlete.deadlift || "—"}
                        </div>
                      </div>
                      <div className={`p-2 rounded ${['farmersWalk', 'yokeWalk', 'dips', 'pullUps'].includes(sortBy) ? 'bg-accent/10 border border-accent/20' : 'bg-muted/30'}`}>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold">{getExerciseLabel(sortBy)}</div>
                        <div className={`font-bold ${['farmersWalk', 'yokeWalk', 'dips', 'pullUps'].includes(sortBy) ? 'text-accent' : 'text-foreground'}`}>
                          {sortBy === 'farmersWalk' ? (athlete.farmersWalkWeight ? `${athlete.farmersWalkWeight} / ${athlete.farmersWalkDistance}m` : "—") :
                            sortBy === 'yokeWalk' ? (athlete.yokeWalkWeight ? `${athlete.yokeWalkWeight} / ${athlete.yokeWalkDistance}m` : "—") :
                              sortBy === 'dips' ? (athlete.dipsWeight ? `${athlete.dipsWeight} x ${athlete.dipsReps}` : (athlete.dipsReps || "—")) :
                                sortBy === 'pullUps' ? (athlete.pullUpsWeight ? `${athlete.pullUpsWeight} x ${athlete.pullUpsReps}` : (athlete.pullUpsReps || "—")) :
                                  "—"}
                        </div>
                      </div>
                    </div>

                    <div className={`mt-3 p-2 rounded text-center ${sortBy === 'total' ? 'bg-accent/10 border border-accent/20' : 'bg-muted/30'}`}>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Total</div>
                      <div className={`text-lg font-black ${sortBy === 'total' ? 'text-accent' : 'text-foreground'}`}>
                        {athlete.total || "—"}
                      </div>
                    </div>

                    {getAthleteVideos(athlete.id).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {getAthleteVideos(athlete.id).map((video) => (
                          <div key={video.exerciseType} className="rounded border border-accent/10 bg-accent/5 p-2">
                            <button
                              onClick={() => openVideo(athlete.id, athlete.name, video)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 bg-accent/10 hover:bg-accent/20 rounded text-xs text-accent font-bold uppercase tracking-wider transition-all active:scale-95"
                            >
                              <Play className="w-3.5 h-3.5" />
                              {`Watch ${getExerciseLabel(video.exerciseType)} PR`}
                            </button>
                            {renderJudgmentStatus(athlete.id, video.exerciseType, "mobile")}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-4 text-left text-xs font-black uppercase text-accent tracking-tighter">Rank</th>
                      <th className="px-4 py-4 text-left text-xs font-black uppercase text-accent tracking-tighter">Athlete</th>
                      <th className="px-4 py-4 text-right text-xs font-black uppercase text-accent tracking-tighter">BW</th>
                      <th
                        onClick={() => setSortBy('squat')}
                        className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === 'squat' ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Squat <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => setSortBy('bench')}
                        className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === 'bench' ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Bench <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => setSortBy('deadlift')}
                        className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === 'deadlift' ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Deadlift <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => setSortBy('ohp')}
                        className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === 'ohp' ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          OHP <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => setSortBy('farmersWalk' as any)}
                        className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === ('farmersWalk' as any) ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                      >
                        <div className="flex items-center justify-end gap-1 text-center leading-tight">
                          Farmers <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => setSortBy('yokeWalk' as any)}
                        className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === ('yokeWalk' as any) ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                      >
                        <div className="flex items-center justify-end gap-1 text-center leading-tight">
                          Yoke <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => setSortBy('dips' as any)}
                        className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === ('dips' as any) ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Dips <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => setSortBy('pullUps' as any)}
                        className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === ('pullUps' as any) ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Pull Ups <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => setSortBy('total')}
                        className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === 'total' ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Total <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-4 py-4 text-right text-xs font-black uppercase text-accent tracking-tighter">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {athletes.map((athlete, idx) => {
                      return (
                        <tr
                          key={athlete.id}
                          className="border-b border-border hover:bg-card/50 transition-colors group"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {idx === 0 && <span className="text-xl">🥇</span>}
                              {idx === 1 && <span className="text-xl">🥈</span>}
                              {idx === 2 && <span className="text-xl">🥉</span>}
                              {idx >= 3 && (
                                <span className="text-xs font-black text-muted-foreground/50">#{idx + 1}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Avatar className="w-12 h-12 border-2 border-accent/20 cursor-pointer hover:scale-105 transition-transform">
                                    <AvatarImage src={athlete.avatarUrl || ""} className="object-cover" />
                                    <AvatarFallback className="bg-muted text-sm font-black">{athlete.name.charAt(0)}</AvatarFallback>
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
                              <div className="font-bold text-foreground group-hover:text-accent transition-colors">
                                {athlete.name}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-xs text-muted-foreground font-medium">
                            {athlete.bodyWeight ? `${athlete.bodyWeight}` : "—"}
                          </td>
                          <td className={`px-4 py-4 text-right text-sm font-bold ${sortBy === 'squat' ? 'text-accent bg-accent/5' : 'text-foreground/70'}`}>
                            {athlete.squat || "—"}
                          </td>
                          <td className={`px-4 py-4 text-right text-sm font-bold ${sortBy === 'bench' ? 'text-accent bg-accent/5' : 'text-foreground/70'}`}>
                            {athlete.bench || "—"}
                          </td>
                          <td className={`px-4 py-4 text-right text-sm font-bold ${sortBy === 'deadlift' ? 'text-accent bg-accent/5' : 'text-foreground/70'}`}>
                            {athlete.deadlift || "—"}
                          </td>
                          <td className={`px-4 py-4 text-right text-sm font-bold ${sortBy === 'ohp' ? 'text-accent bg-accent/5' : 'text-foreground/70'}`}>
                            {athlete.ohp || "—"}
                          </td>
                          <td className={`px-4 py-4 text-right text-xs font-bold ${sortBy === 'farmersWalk' ? 'text-accent bg-accent/5' : 'text-foreground/70'}`}>
                            {athlete.farmersWalkWeight ? `${athlete.farmersWalkWeight} / ${athlete.farmersWalkDistance}m` : "—"}
                          </td>
                          <td className={`px-4 py-4 text-right text-xs font-bold ${sortBy === 'yokeWalk' ? 'text-accent bg-accent/5' : 'text-foreground/70'}`}>
                            {athlete.yokeWalkWeight ? `${athlete.yokeWalkWeight} / ${athlete.yokeWalkDistance}m` : "—"}
                          </td>
                          <td className={`px-4 py-4 text-right text-sm font-bold ${sortBy === 'dips' ? 'text-accent bg-accent/5' : 'text-foreground/70'}`}>
                            {athlete.dipsWeight ? `${athlete.dipsWeight} x ${athlete.dipsReps}` : (athlete.dipsReps || "—")}
                          </td>
                          <td className={`px-4 py-4 text-right text-sm font-bold ${sortBy === 'pullUps' ? 'text-accent bg-accent/5' : 'text-foreground/70'}`}>
                            {athlete.pullUpsWeight ? `${athlete.pullUpsWeight} x ${athlete.pullUpsReps}` : (athlete.pullUpsReps || "—")}
                          </td>
                          <td className={`px-4 py-4 text-right text-base font-black ${sortBy === 'total' ? 'text-accent bg-accent/10' : 'text-foreground'}`}>
                            {athlete.total || "—"}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {getAthleteVideos(athlete.id).map((video) => (
                                <div key={video.exerciseType} className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => openVideo(athlete.id, athlete.name, video)}
                                    className="flex items-center gap-1 px-2 py-1 bg-accent/10 hover:bg-accent/20 rounded text-[10px] text-accent font-bold uppercase tracking-wider transition-all"
                                    title={`Watch ${getExerciseLabel(video.exerciseType)} PR`}
                                  >
                                    <Play className="w-3 h-3" />
                                    {getExerciseLabel(video.exerciseType)}
                                  </button>
                                  {renderJudgmentStatus(athlete.id, video.exerciseType, "desktop")}
                                </div>
                              ))}
                              <Link href={`/athlete/${athlete.id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-[10px] uppercase font-black hover:bg-accent hover:text-black transition-all"
                                >
                                  View
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Stats section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <Card className="card-dramatic text-center">
            <div className="text-4xl font-bold text-accent mb-2">{athletes.length}</div>
            <div className="text-muted-foreground uppercase text-sm font-bold">Total Athletes</div>
          </Card>
          <Card className="card-dramatic text-center">
            <div className="text-4xl font-bold text-accent mb-2">
              {athletes[0]?.total ? `${athletes[0].total}` : "—"}
            </div>
            <div className="text-muted-foreground uppercase text-sm font-bold">Top Total</div>
          </Card>
          <Card className="card-dramatic text-center">
            <div className="text-4xl font-bold text-accent mb-2">
              {athletes[0]?.bodyWeight ? `${athletes[0].bodyWeight}` : "—"}
            </div>
            <div className="text-muted-foreground uppercase text-sm font-bold">Champion BW</div>
          </Card>
        </div>
          </>
        )}
      </div>

    {/* Video Playback & Judging Dialog */}
    <Dialog open={!!playingVideo} onOpenChange={(open) => {
      if (open) return;
      setPlayingVideo(null);
      setCommentDraft("");
    }}>
      <DialogContent className="sm:max-w-2xl bg-black border-accent/30 p-3 sm:p-6">
        <DialogTitle className="text-accent uppercase font-black tracking-widest text-xs sm:text-sm mb-4">
          {playingVideo?.name} — {getExerciseLabel(playingVideo?.exercise || "")} PR
        </DialogTitle>
        {playingVideo && (
          <div className="space-y-6">
            <video
              src={playingVideo.url}
              controls
              autoPlay
              playsInline
              className="w-full aspect-video rounded-lg shadow-[0_0_30px_rgba(216,180,105,0.2)] border border-accent/20"
            />

            {/* Judging Interface inside Dialog */}
            <div className="bg-accent/5 border border-accent/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-accent">Official Judging</h4>
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => {
                    const videoJudgments = getVideoJudgments(playingVideo.athleteId, playingVideo.exercise);
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
                const myJudgment = allJudgments.find(j => 
                  j.athleteId === playingVideo.athleteId && 
                  j.exerciseType === playingVideo.exercise && 
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
                      onClick={() => submitVoteMutation.mutate({ athleteId: playingVideo.athleteId, exerciseType: playingVideo.exercise, vote: 'white' })}
                      disabled={submitVoteMutation.isPending || myJudgment.vote === 'white'}
                      className={`flex-1 h-12 rounded-lg font-black uppercase tracking-widest transition-all ${
                        myJudgment.vote === 'white' ? 'bg-white text-black border-white' : 'bg-transparent border-white text-white hover:bg-white hover:text-black'
                      } border-2`}
                    >
                      White Light
                    </Button>
                    <Button
                      onClick={() => submitVoteMutation.mutate({ athleteId: playingVideo.athleteId, exerciseType: playingVideo.exercise, vote: 'red' })}
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

            <div className="bg-card/60 border border-accent/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-accent">Comments</h4>
                <span className="text-[10px] text-muted-foreground font-bold uppercase">
                  {getVideoComments(playingVideo.athleteId, playingVideo.exercise).length}
                </span>
              </div>

              <div className="space-y-3 max-h-44 overflow-y-auto pr-1 mb-4">
                {getVideoComments(playingVideo.athleteId, playingVideo.exercise).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No comments yet. Start the thread.</p>
                ) : (
                  getVideoComments(playingVideo.athleteId, playingVideo.exercise).map((comment) => (
                    <div key={comment.id} className="rounded-lg bg-black/30 border border-white/5 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-black uppercase text-foreground truncate">
                          {comment.userName || comment.userEmail || "Member"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-bold shrink-0">
                          {formatUploadTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground break-words">{comment.comment}</p>
                    </div>
                  ))
                )}
              </div>

              {isAuthenticated ? (
                <div className="space-y-2">
                  <Textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    maxLength={280}
                    placeholder="Add a comment..."
                    className="min-h-20 bg-black/30 border-accent/20 text-sm"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground font-bold">{commentDraft.length}/280</span>
                    <Button
                      onClick={submitComment}
                      disabled={addCommentMutation.isPending || commentDraft.trim().length === 0}
                      size="sm"
                      className="bg-accent text-black hover:bg-accent/90 font-black uppercase"
                    >
                      Comment
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  Login to comment on this PR video.
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </div>
  );
}

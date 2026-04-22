import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowLeft, Edit2, Save, X, Play, Video, Users, Trash2 } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AthleteProfile() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<{ exercise: string; url: string } | null>(null);
  const [selectingJudges, setSelectingJudges] = useState<string | null>(null);
  const [tempJudgeIds, setTempJudgeIds] = useState<number[]>([]);

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

  const athleteId = parseInt(id || "0");
  const { data: athlete, isLoading: athleteLoading } = trpc.athlete.getById.useQuery({
    id: athleteId,
  });

  const { data: liftHistory = [] } = trpc.athlete.getLiftHistory.useQuery({
    athleteId,
  });

  const { data: weightHistory = [] } = trpc.athlete.getWeightHistory.useQuery({
    athleteId,
  });

  const { data: prVideos = [], refetch: refetchPrVideos } = trpc.athlete.getPrVideos.useQuery(
    { athleteId },
    { enabled: !!athleteId }
  );

  const { data: allJudgments = [], refetch: refetchJudgments } = trpc.athlete.getAllPrVideoJudgments.useQuery();
  const { data: communityUsers = [] } = trpc.system.getAllUsers.useQuery();

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

  const handleDeleteVideo = async (exerciseType: string) => {
    if (!confirm(`Are you sure you want to delete your ${exerciseType} PR video?`)) return;
    try {
      await deletePrVideoMutation.mutateAsync({ athleteId, exerciseType });
      toast.success("Video deleted");
      refetchPrVideos();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete video");
    }
  };

  const [formData, setFormData] = useState({
    bodyWeight: athlete?.bodyWeight || "",
    squat: athlete?.squat || "",
    bench: athlete?.bench || "",
    deadlift: athlete?.deadlift || "",
    ohp: athlete?.ohp || "",
  });

  const updateProfileMutation = trpc.athlete.updateProfile.useMutation();

  const handleSave = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        athleteId,
        bodyWeight: formData.bodyWeight ? parseFloat(formData.bodyWeight) : undefined,
        squat: formData.squat ? parseFloat(formData.squat) : undefined,
        bench: formData.bench ? parseFloat(formData.bench) : undefined,
        deadlift: formData.deadlift ? parseFloat(formData.deadlift) : undefined,
        ohp: formData.ohp ? parseFloat(formData.ohp) : undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  if (athleteLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Loading athlete profile...</p>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Athlete not found</p>
          <Button className="btn-dramatic" onClick={() => navigate("/")}>
            Back to Leaderboard
          </Button>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = weightHistory.map((entry) => ({
    date: new Date(entry.recordedDate).toLocaleDateString(),
    weight: parseFloat(entry.weight),
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border light-ray">
        <div className="container py-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-accent hover:text-accent/80 mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="uppercase font-bold">Back</span>
          </button>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold uppercase tracking-wider mb-2">
                {athlete.name}
              </h1>
              <p className="text-muted-foreground">
                {athlete.bodyWeight ? `${athlete.bodyWeight} lbs` : "Body weight not recorded"}
              </p>
            </div>
            {isAuthenticated && user?.athleteId === athleteId && (
              <Button
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
                    Edit
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container py-12">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
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
                <div className="text-[10px] md:text-xs text-muted-foreground uppercase font-bold tracking-widest mt-1">
                  {stat.label}
                </div>
                
                {/* Video buttons */}
                <div className="flex items-center justify-center gap-1 mt-2">
                  {video && (
                    <button
                      onClick={() => setPlayingVideo({ exercise: stat.label, url: video.videoUrl })}
                      className="flex items-center gap-1 px-2 py-1 bg-accent/10 hover:bg-accent/20 rounded text-[10px] text-accent font-bold uppercase tracking-wider transition-all"
                    >
                      <Play className="w-3 h-3" /> Watch
                    </button>
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
                        if (!judgment) return <div key={i} className="w-2.5 h-2.5 rounded-full border border-muted-foreground/30" />;
                        return (
                          <div 
                            key={i} 
                            className={`w-2.5 h-2.5 rounded-full border shadow-sm ${
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
                      <span className="text-[9px] font-black text-white bg-green-600 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(22,163,74,0.5)]">
                        APPROVED
                      </span>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Edit form */}
        {isEditing && (
          <Card className="card-dramatic mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold uppercase">Edit Profile</h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: "Body Weight (lbs)", key: "bodyWeight" },
                { label: "Squat (lbs)", key: "squat" },
                { label: "Bench (lbs)", key: "bench" },
                { label: "Deadlift (lbs)", key: "deadlift" },
                { label: "OHP (lbs)", key: "ohp" },
              ].map((field) => (
                <div key={field.key}>
                  <Label className="text-accent uppercase font-bold text-sm mb-2 block">
                    {field.label}
                  </Label>
                  <Input
                    type="number"
                    value={formData[field.key as keyof typeof formData]}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [field.key]: e.target.value,
                      })
                    }
                    className="bg-input border-border text-foreground"
                    placeholder="Enter value"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-8">
              <Button className="btn-dramatic flex-1" onClick={handleSave}>
                Save Changes
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {/* Weight progress chart */}
        {chartData.length > 0 && (
          <Card className="card-dramatic mb-12">
            <h2 className="text-2xl font-bold uppercase mb-6">Weight Progress</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(216, 180, 105, 0.1)" />
                <XAxis dataKey="date" stroke="rgba(216, 180, 105, 0.6)" />
                <YAxis stroke="rgba(216, 180, 105, 0.6)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(13, 13, 13, 0.95)",
                    border: "1px solid rgba(216, 180, 105, 0.3)",
                  }}
                  labelStyle={{ color: "rgba(216, 180, 105, 1)" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="rgba(216, 180, 105, 1)"
                  dot={{ fill: "rgba(216, 180, 105, 1)", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Body Weight (lbs)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Lift history */}
        {liftHistory.length > 0 && (
          <Card className="card-dramatic">
            <h2 className="text-2xl font-bold uppercase mb-6">Lift History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-bold uppercase text-accent">Exercise</th>
                    <th className="px-4 py-3 text-right font-bold uppercase text-accent">Weight</th>
                    <th className="px-4 py-3 text-right font-bold uppercase text-accent">Reps</th>
                    <th className="px-4 py-3 text-right font-bold uppercase text-accent">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {liftHistory.slice(-10).reverse().map((lift) => (
                    <tr key={lift.id} className="border-b border-border hover:bg-card/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{lift.exerciseType}</td>
                      <td className="px-4 py-3 text-right text-accent">{lift.weight} lbs</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{lift.reps}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {new Date(lift.recordedDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
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
                  .filter(u => u.id !== athlete.userId) // Can't judge your own lift
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
          <DialogHeader>
            <DialogTitle className="text-accent uppercase font-black tracking-widest text-xs sm:text-sm mb-4">
              {athlete?.name} — {playingVideo?.exercise} PR
            </DialogTitle>
          </DialogHeader>
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

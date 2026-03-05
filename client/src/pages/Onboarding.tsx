import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Trophy, Save, ChevronRight, Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Onboarding() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const utils = trpc.useUtils();

    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: "",
        gender: "" as "" | "male" | "female",
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
        gymInviteCode: "",
    });
    const [uploading, setUploading] = useState(false);

    // Auto-fill name from auth data when it loads
    useEffect(() => {
        if (user?.name && !formData.name) {
            setFormData(prev => ({ ...prev, name: user.name || "" }));
        }
    }, [user?.name]);

    const setupMutation = trpc.athlete.setupProfile.useMutation({
        onSuccess: async () => {
            await utils.auth.me.invalidate();
            // If they entered an invite code, join the gym
            if (formData.gymInviteCode) {
                try {
                    await joinGymMutation.mutateAsync({ inviteCode: formData.gymInviteCode });
                } catch (e) {
                    console.warn("Failed to join gym during onboarding, but profile was created.");
                }
            }
            toast.success("Profile created! Welcome to the leaderboard.");
            setLocation("/");
        },
        onError: (err) => {
            toast.error(err.message || "Failed to create profile. Please try again.");
        }
    });

    const joinGymMutation = trpc.gym.join.useMutation();
    const { data: gyms = [] } = trpc.gym.getAll.useQuery();

    const [isRequestingGym, setIsRequestingGym] = useState(false);
    const [requestedGymName, setRequestedGymName] = useState("");

    const requestGymMutation = trpc.gym.requestAdd.useMutation();

    const parseNumberInput = (value: string) => (value.trim() === "" ? undefined : parseFloat(value));
    const parseIntInput = (value: string) => (value.trim() === "" ? undefined : parseInt(value, 10));


    const handleRequestGym = async () => {
        if (!requestedGymName) return;
        try {
            await requestGymMutation.mutateAsync({ name: requestedGymName });
            toast.success("Request sent! Admin will approve it soon.");
            setFormData(prev => ({ ...prev, gymInviteCode: "" })); // Keep as solo for now
            setRequestedGymName("");
            setIsRequestingGym(false);
            setStep(4); // Move to review step
        } catch (e: any) {
            toast.error(e.message || "Failed to send request");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
            toast.success("Image uploaded!");
        } catch (error: any) {
            toast.error(error.message || "Failed to upload image. (Make sure you have an 'avatars' bucket in Supabase)");
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        await setupMutation.mutateAsync({
            name: formData.name,
            gender: formData.gender as "male" | "female",
            avatarUrl: formData.avatarUrl || undefined,
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
        });
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
            <div className="max-w-xl w-full">
                <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <Trophy className="w-16 h-16 text-accent mx-auto mb-6" />
                    <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-2">
                        Welcome to the Elite
                    </h1>
                    <p className="text-muted-foreground text-lg uppercase font-bold tracking-widest">
                        Let's set up your profile
                    </p>
                </div>

                <Card className="card-dramatic p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-muted">
                        <div
                            className="h-full bg-accent transition-all duration-500"
                            style={{ width: `${(step / 4) * 100}%` }}
                        />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {step === 1 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex flex-col items-center gap-6 mb-8">
                                    <div className="relative group">
                                        <Avatar className="w-32 h-32 border-4 border-accent/20 group-hover:border-accent transition-all duration-500">
                                            <AvatarImage src={formData.avatarUrl} className="object-cover" />
                                            <AvatarFallback className="bg-card text-accent">
                                                <Camera className="w-10 h-10" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <label
                                            htmlFor="pfp-upload"
                                            className="absolute bottom-0 right-0 bg-accent text-black p-2 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg"
                                        >
                                            <Upload className="w-5 h-5" />
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
                                    <div className="text-center">
                                        <p className="text-xs uppercase font-black text-accent tracking-widest mb-1">
                                            {uploading ? "Uploading..." : "Profile Image"}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold italic">Show them who's coming for the #1 spot</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-black text-accent tracking-widest">
                                        Gender *
                                    </Label>
                                    <div className="flex bg-card/50 border border-border rounded-lg p-1 h-14">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, gender: "male" })}
                                            className={`flex-1 rounded-md text-sm font-black uppercase tracking-wider transition-all duration-200 ${formData.gender === "male"
                                                    ? "bg-accent text-black shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                                }`}
                                        >
                                            🏋️ Male
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, gender: "female" })}
                                            className={`flex-1 rounded-md text-sm font-black uppercase tracking-wider transition-all duration-200 ${formData.gender === "female"
                                                    ? "bg-accent text-black shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                                }`}
                                        >
                                            💪 Female
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground uppercase font-bold">This determines which leaderboard you appear on.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-xs uppercase font-black text-accent tracking-widest">
                                        Your Full Name
                                    </Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Enter your name as you want it on the leaderboard"
                                        className="bg-card/50 border-border text-lg h-14"
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground uppercase font-bold">This is how you will appear to other athletes.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="bw" className="text-xs uppercase font-black text-accent tracking-widest">
                                        Current Body Weight (lbs)
                                    </Label>
                                    <Input
                                        id="bw"
                                        type="number"
                                        value={formData.bodyWeight}
                                        onChange={(e) => setFormData({ ...formData, bodyWeight: e.target.value })}
                                        placeholder="e.g. 185"
                                        className="bg-card/50 border-border text-lg h-14"
                                    />
                                </div>

                                <Button
                                    type="button"
                                    onClick={() => formData.name && formData.gender && setStep(2)}
                                    disabled={!formData.name || !formData.gender}
                                    className="w-full btn-dramatic h-14 text-lg"
                                >
                                    Next Step <ChevronRight className="ml-2 w-5 h-5" />
                                </Button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <h3 className="text-xs uppercase font-black text-accent tracking-widest mb-4">Input Your Personal Records (Optional)</h3>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Squat</Label>
                                        <Input
                                            type="number"
                                            value={formData.squat}
                                            onChange={(e) => setFormData({ ...formData, squat: e.target.value })}
                                            placeholder="Lbs"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Bench Press</Label>
                                        <Input
                                            type="number"
                                            value={formData.bench}
                                            onChange={(e) => setFormData({ ...formData, bench: e.target.value })}
                                            placeholder="Lbs"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Deadlift</Label>
                                        <Input
                                            type="number"
                                            value={formData.deadlift}
                                            onChange={(e) => setFormData({ ...formData, deadlift: e.target.value })}
                                            placeholder="Lbs"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">OHP</Label>
                                        <Input
                                            type="number"
                                            value={formData.ohp}
                                            onChange={(e) => setFormData({ ...formData, ohp: e.target.value })}
                                            placeholder="Lbs"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Farmers (W)</Label>
                                        <Input
                                            type="number"
                                            value={formData.farmersWalkWeight}
                                            onChange={(e) => setFormData({ ...formData, farmersWalkWeight: e.target.value })}
                                            placeholder="Lbs"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Farmers (D)</Label>
                                        <Input
                                            type="number"
                                            value={formData.farmersWalkDistance}
                                            onChange={(e) => setFormData({ ...formData, farmersWalkDistance: e.target.value })}
                                            placeholder="Meters"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Yoke (W)</Label>
                                        <Input
                                            type="number"
                                            value={formData.yokeWalkWeight}
                                            onChange={(e) => setFormData({ ...formData, yokeWalkWeight: e.target.value })}
                                            placeholder="Lbs"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Yoke (D)</Label>
                                        <Input
                                            type="number"
                                            value={formData.yokeWalkDistance}
                                            onChange={(e) => setFormData({ ...formData, yokeWalkDistance: e.target.value })}
                                            placeholder="Meters"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Dips (W)</Label>
                                        <Input
                                            type="number"
                                            value={formData.dipsWeight}
                                            onChange={(e) => setFormData({ ...formData, dipsWeight: e.target.value })}
                                            placeholder="Lbs"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Dips (R)</Label>
                                        <Input
                                            type="number"
                                            value={formData.dipsReps}
                                            onChange={(e) => setFormData({ ...formData, dipsReps: e.target.value })}
                                            placeholder="Reps"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Pull Ups (W)</Label>
                                        <Input
                                            type="number"
                                            value={formData.pullUpsWeight}
                                            onChange={(e) => setFormData({ ...formData, pullUpsWeight: e.target.value })}
                                            placeholder="Lbs"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Pull Ups (R)</Label>
                                        <Input
                                            type="number"
                                            value={formData.pullUpsReps}
                                            onChange={(e) => setFormData({ ...formData, pullUpsReps: e.target.value })}
                                            placeholder="Reps"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setStep(1)}
                                        className="flex-1 h-14 uppercase font-bold"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => setStep(3)}
                                        className="flex-[2] btn-dramatic h-14 text-lg"
                                    >
                                        Next (Gym Space) <ChevronRight className="ml-2 w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <h2 className="text-xs uppercase font-black text-accent tracking-widest mb-4">Join a Gym Space</h2>
                                <p className="text-muted-foreground text-sm mb-6 font-bold uppercase italic">
                                    Connect with your community. Join a space or lift solo.
                                </p>

                                <div className="space-y-6">
                                    {!isRequestingGym ? (
                                        <div className="space-y-4">
                                            <div
                                                className="p-4 bg-accent/10 border-2 border-accent/20 rounded-lg cursor-pointer hover:border-accent group transition-all"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, gymInviteCode: "FIT123" }));
                                                    setStep(4);
                                                }}
                                            >
                                                <h3 className="font-black uppercase text-accent group-hover:scale-105 transition-transform origin-left">Join Fitness Factory</h3>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold italic">The default shared community space.</p>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Select from existing gyms</Label>
                                                <Select
                                                    onValueChange={(code: string) => {
                                                        setFormData(prev => ({ ...prev, gymInviteCode: code }));
                                                        setStep(4);
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full bg-card/50 border-border h-12 uppercase font-black text-xs">
                                                        <SelectValue placeholder="CHOOSE A GYM" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-card border-border">
                                                        {gyms.map(gym => (
                                                            <SelectItem key={gym.id} value={gym.inviteCode} className="font-bold uppercase text-xs">
                                                                🏟️ {gym.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Or Enter Invite Code</Label>
                                                <Input
                                                    placeholder="CODE123"
                                                    value={formData.gymInviteCode}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, gymInviteCode: e.target.value.toUpperCase() }))}
                                                    className="bg-card/50 border-border h-12"
                                                />
                                            </div>

                                            <div className="relative py-4">
                                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                                                <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest"><span className="bg-card px-2 text-accent italic">OR</span></div>
                                            </div>

                                            <div className="flex flex-col gap-3 text-center">
                                                <Button type="button" variant="outline" className="w-full h-12 uppercase font-black italic tracking-widest" onClick={() => setIsRequestingGym(true)}>
                                                    Request New Space
                                                </Button>
                                                <Button type="button" variant="ghost" className="w-full text-muted-foreground underline text-[10px] uppercase font-bold" onClick={() => {
                                                    setFormData(prev => ({ ...prev, gymInviteCode: "" }));
                                                    setStep(4);
                                                }}>
                                                    Skip for now (Global Leaderboard only)
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <h3 className="text-[10px] font-black text-accent uppercase tracking-widest">Request a New Gym Space</h3>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Gym Name</Label>
                                                <Input
                                                    placeholder="e.g. Iron Palace"
                                                    value={requestedGymName}
                                                    onChange={(e) => setRequestedGymName(e.target.value)}
                                                    className="bg-card/50 border-border h-12"
                                                />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground italic leading-tight">
                                                Submit the name of the gym you'd like to see added. An admin will review and add it to the database.
                                            </p>
                                            <div className="flex gap-4 pt-4">
                                                <Button
                                                    type="button"
                                                    className="btn-dramatic flex-1 h-12 uppercase font-black italic"
                                                    onClick={handleRequestGym}
                                                    disabled={!requestedGymName || requestGymMutation.isPending}
                                                >
                                                    {requestGymMutation.isPending ? "Sending..." : "Submit Request"}
                                                </Button>
                                                <Button type="button" variant="outline" className="flex-1 h-12 uppercase font-black" onClick={() => setIsRequestingGym(false)}>Back</Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {!isRequestingGym && (
                                    <div className="flex gap-4 pt-8">
                                        <Button type="button" variant="outline" className="flex-1 h-14 uppercase font-bold" onClick={() => setStep(2)}>Back</Button>
                                        <Button type="button" className="flex-[2] btn-dramatic h-14 text-lg" onClick={() => setStep(4)} disabled={!formData.gymInviteCode}>
                                            Review <ChevronRight className="ml-2 w-5 h-5" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <h2 className="text-xs uppercase font-black text-accent tracking-widest mb-4">Final Review</h2>

                                <Card className="p-6 border-accent/40 bg-accent/5 card-dramatic">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center border-b border-border pb-2">
                                            <span className="text-muted-foreground text-[10px] uppercase font-black tracking-widest">Athlete</span>
                                            <span className="font-black uppercase italic">{formData.name}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-border pb-2">
                                            <span className="text-muted-foreground text-[10px] uppercase font-black tracking-widest">Gym Space</span>
                                            <span className="font-black text-accent uppercase italic">
                                                {gyms.find(g => g.inviteCode === formData.gymInviteCode)?.name || (formData.gymInviteCode || "Global Only")}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-4">
                                            <div className="text-center p-3 bg-card border border-border rounded-lg">
                                                <div className="text-[10px] text-muted-foreground uppercase font-bold">Squat</div>
                                                <div className="text-2xl font-black text-accent">{formData.squat || "0"}</div>
                                            </div>
                                            <div className="text-center p-3 bg-card border border-border rounded-lg">
                                                <div className="text-[10px] text-muted-foreground uppercase font-bold">Bench</div>
                                                <div className="text-2xl font-black text-accent">{formData.bench || "0"}</div>
                                            </div>
                                            <div className="text-center p-3 bg-card border border-border rounded-lg">
                                                <div className="text-[10px] text-muted-foreground uppercase font-bold">Deadlift</div>
                                                <div className="text-2xl font-black text-accent">{formData.deadlift || "0"}</div>
                                            </div>
                                            <div className="text-center p-3 bg-card border border-border rounded-lg">
                                                <div className="text-[10px] text-muted-foreground uppercase font-bold">Total</div>
                                                <div className="text-2xl font-black text-accent">
                                                    {(parseFloat(formData.squat || "0") + parseFloat(formData.bench || "0") + parseFloat(formData.deadlift || "0")).toFixed(1)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <div className="flex gap-4">
                                    <Button type="button" variant="outline" className="flex-1 h-14 uppercase font-bold" onClick={() => setStep(3)}>Back</Button>
                                    <Button type="submit" className="flex-[2] btn-dramatic h-14 text-lg" disabled={setupMutation.isPending}>
                                        {setupMutation.isPending ? "Joining the Elite..." : "Finalize Profile"} <Save className="ml-2 w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </form>
                </Card>
            </div>
        </div>
    );
}

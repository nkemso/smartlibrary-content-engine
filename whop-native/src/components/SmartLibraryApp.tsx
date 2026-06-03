import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { DashboardViewProps, DiscoverViewProps, ExperienceViewProps } from "@whop/react-native";
import { Card, Header, Pill, PrimaryButton, SectionTitle, Shell } from "./ui";
import { colors, radius, spacing } from "../lib/design";
import { cacheGet, cacheSet, getHostDetails, setNavigationBar } from "../lib/whop-host";
import {
  buildSuggestedPrompt,
  createLocalOutput,
  makeId,
  retrieveRelevantSources,
  transformActions,
  type ContentTier,
  type LibraryItem,
  type RetrievedSource,
  type TransformAction,
} from "../lib/smartlibrary-engine";

type SmartLibraryProps =
  | ({ mode: "experience" } & ExperienceViewProps)
  | ({ mode: "dashboard" } & DashboardViewProps)
  | ({ mode: "discover" } & DiscoverViewProps);

type ProcessingStage = "idle" | "retrieving" | "thinking" | "ready" | "error";
type WorkspaceTab = "overview" | "learn" | "tutor" | "certificates" | "builder" | "admin" | "automation";

const API_FALLBACK = "https://smartlibrary-content-engine.vercel.app";
const tierPresets = ["Free", "Premium", "VIP", "Gold", "Cohort", "Inner Circle", "Masterclass", "Enterprise"];
const uploadPresets: Array<LibraryItem["type"]> = ["course", "video", "file", "audio", "manual", "transcript", "link"];
const dripPresets = ["Instant", "3 days after joining", "7 days after joining", "After previous lesson", "After quiz pass", "Cohort date"];

const starterCourseAsset = `Creator uploaded a course asset for SmartLibrary processing. The asset should be transformed into a premium learning journey with modules, lessons, exercises, assignments, quizzes, drip rules, tier-gated access, progress tracking, badges, XP, and interactive checkpoints.`;

export function SmartLibraryApp(props: SmartLibraryProps) {
  const host = useMemo(() => getHostDetails(), []);
  const userId = props.currentUserId ?? "anonymous";
  const scopeId = props.mode === "experience" ? props.experienceId : props.mode === "dashboard" ? props.companyId : "discover";
  const cacheKey = `smartlibrary:v5:organized:${userId}:${scopeId}`;
  const initialTab: WorkspaceTab = props.mode === "dashboard" ? "overview" : props.mode === "experience" ? "learn" : "overview";

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [tiers, setTiers] = useState<ContentTier[]>([
    { id: "tier_free", name: "Free", description: "Public starter content", color: colors.primary2 },
    { id: "tier_premium", name: "Premium", description: "Paid member content", color: colors.primary },
  ]);
  const [selectedTierIds, setSelectedTierIds] = useState<string[]>(["tier_premium"]);
  const [selectedType, setSelectedType] = useState<LibraryItem["type"]>("course");
  const [selectedDrip, setSelectedDrip] = useState(dripPresets[0] as string);
  const [activeAction, setActiveAction] = useState<TransformAction>("Structure Course");
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [stageText, setStageText] = useState("Ready.");
  const [output, setOutput] = useState(firstRunOutput(props.mode));
  const [sources, setSources] = useState<RetrievedSource[]>([]);

  const apiOrigin = host.apiOrigin || API_FALLBACK;
  const totalWords = library.reduce((sum, item) => sum + item.wordCount, 0);
  const isBusy = stage === "retrieving" || stage === "thinking";
  const tabs = getTabs(props.mode);

  useEffect(() => {
    const title = props.mode === "dashboard" ? "SmartLibrary Admin" : props.mode === "experience" ? "SmartLibrary Learning" : "SmartLibrary";
    setNavigationBar(title, "AI course hosting and learning engine");
    const cached = cacheGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { library?: LibraryItem[]; tiers?: ContentTier[] };
        if (Array.isArray(parsed.library)) setLibrary(parsed.library);
        if (Array.isArray(parsed.tiers)) setTiers(parsed.tiers);
      } catch {
        setStageText("Workspace ready.");
      }
    }
  }, [cacheKey, props.mode]);

  useEffect(() => {
    cacheSet(cacheKey, JSON.stringify({ library, tiers }));
  }, [cacheKey, library, tiers]);

  function toggleTier(id: string) {
    setSelectedTierIds((current) => (current.includes(id) ? current.filter((tierId) => tierId !== id) : [...current, id]));
  }

  function addTier(name: string) {
    const exists = tiers.some((tier) => tier.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    const tier: ContentTier = { id: makeId("tier"), name, description: `${name} gated content`, color: colors.primary2 };
    setTiers((current) => [...current, tier]);
    setSelectedTierIds((current) => [...current, tier.id]);
  }

  async function createCourseAsset() {
    const assignedTiers = tiers.filter((tier) => selectedTierIds.includes(tier.id)).map((tier) => tier.name).join(", ") || "Ungated";
    const assetTitle = `${selectedType.charAt(0).toUpperCase()}${selectedType.slice(1)} Course Asset`;
    const content = `Upload Type: ${selectedType}. Assigned Tiers: ${assignedTiers}. Drip Rule: ${selectedDrip}. ${starterCourseAsset}`;
    const item: LibraryItem = {
      id: makeId("asset"),
      title: assetTitle,
      type: selectedType,
      content,
      source: "Creator upload placeholder",
      tierIds: selectedTierIds,
      dripRule: {
        type: selectedDrip.includes("after") || selectedDrip.includes("After") ? "after_completion" : selectedDrip.includes("days") ? "days_after_join" : selectedDrip.includes("date") || selectedDrip.includes("Cohort") ? "date" : "instant",
        description: selectedDrip,
      },
      interactive: true,
      createdAt: new Date().toISOString(),
      wordCount: content.split(/\s+/).length,
    };
    const nextLibrary = [item, ...library].slice(0, 60);
    setLibrary(nextLibrary);
    await transform("Structure Course", buildSuggestedPrompt(item), nextLibrary);
  }

  async function transform(action = activeAction, question = "Structure this course into modules, lessons, exercises, assignments, quizzes, drip logic, tier access, and gamified checkpoints.", currentLibrary = library) {
    setActiveAction(action);
    setStage("retrieving");
    setStageText("Retrieving course context...");
    const retrieved = retrieveRelevantSources(currentLibrary, question || action, 5);
    setSources(retrieved);
    const localOutput = createLocalOutput(action, question || action, retrieved, currentLibrary);
    setOutput(localOutput);
    if (!currentLibrary.length) {
      setStage("ready");
      setStageText("Create a course asset first.");
      return;
    }
    setStage("thinking");
    setStageText("Generating learning structure...");
    try {
      const response = await fetch(`${apiOrigin}/api/transform`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, question, sources: retrieved }),
      });
      if (response.ok) {
        const data = (await response.json()) as { output?: string; provider?: string };
        if (data.output && data.output.trim()) setOutput(data.output.trim());
        setStageText(`Output ready${data.provider ? ` via ${data.provider}` : ""}.`);
      } else setStageText("Output ready using local fallback.");
      setStage("ready");
    } catch {
      setStage("ready");
      setStageText("Output ready using local fallback.");
    }
  }

  function clearWorkspace() {
    setLibrary([]);
    setSources([]);
    setOutput(firstRunOutput(props.mode));
    setStage("idle");
    setStageText("Workspace cleared.");
  }

  return (
    <Shell>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header title="SmartLibrary" subtitle={getSubtitle(props.mode)} badge={getBadge(props.mode)} />
        <Hero mode={props.mode} libraryCount={library.length} tierCount={tiers.length} totalWords={totalWords} />
        <TabBar tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
        <StatusCard stage={stage} text={stageText} busy={isBusy} />

        {activeTab === "overview" ? (
          <Overview mode={props.mode} setActiveTab={setActiveTab} library={library} tiers={tiers} />
        ) : activeTab === "learn" ? (
          <LearnerDashboard library={library} tiers={tiers} setActiveTab={setActiveTab} />
        ) : activeTab === "tutor" ? (
          <AITutor output={output} sources={sources} isBusy={isBusy} transform={transform} />
        ) : activeTab === "certificates" ? (
          <CertificatesAndCommunity />
        ) : activeTab === "builder" ? (
          <CreatorStudio
            library={library}
            tiers={tiers}
            selectedTierIds={selectedTierIds}
            selectedType={selectedType}
            selectedDrip={selectedDrip}
            activeAction={activeAction}
            output={output}
            isBusy={isBusy}
            setSelectedType={setSelectedType}
            setSelectedDrip={setSelectedDrip}
            toggleTier={toggleTier}
            addTier={addTier}
            createCourseAsset={createCourseAsset}
            transform={transform}
          />
        ) : activeTab === "admin" ? (
          <AdminDashboard tiers={tiers} library={library} />
        ) : (
          <AutomationCenter clearWorkspace={clearWorkspace} />
        )}
      </ScrollView>
    </Shell>
  );
}

function getTabs(mode: SmartLibraryProps["mode"]): Array<{ id: WorkspaceTab; label: string }> {
  if (mode === "experience") return [{ id: "learn", label: "Learn" }, { id: "tutor", label: "AI Tutor" }, { id: "certificates", label: "Certificates" }];
  if (mode === "dashboard") return [{ id: "overview", label: "Overview" }, { id: "builder", label: "Builder" }, { id: "admin", label: "Admin" }, { id: "automation", label: "Automation" }];
  return [{ id: "overview", label: "Overview" }, { id: "learn", label: "Learner" }, { id: "builder", label: "Creator" }];
}

function getSubtitle(mode: SmartLibraryProps["mode"]) {
  if (mode === "dashboard") return "Creator and admin command center";
  if (mode === "experience") return "Your intelligent learning workspace";
  return "AI course hosting and learning engine";
}

function getBadge(mode: SmartLibraryProps["mode"]) {
  if (mode === "dashboard") return "Admin";
  if (mode === "experience") return "Learner";
  return "Preview";
}

function Hero({ mode, libraryCount, tierCount, totalWords }: { mode: string; libraryCount: number; tierCount: number; totalWords: number }) {
  const title = mode === "dashboard" ? "Build, gate, drip, and automate premium courses" : "Continue learning with AI guidance";
  const body = mode === "dashboard" ? "A focused creator console for course assets, tiers, drip rules, AI tutors, automation, analytics, and admin control." : "A clean learner dashboard with progress, learning paths, AI tutor help, community, certificates, XP, and next-step guidance.";
  return (
    <Card style={styles.hero}>
      <View style={styles.heroTop}><Pill label="Premium SaaS" tone="success" /><Text style={styles.heroStat}>{libraryCount} assets</Text></View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroText}>{body}</Text>
      <View style={styles.statRow}><MiniStat label="Assets" value={String(libraryCount)} /><MiniStat label="Tiers" value={String(tierCount)} /><MiniStat label="Words" value={formatNumber(totalWords)} /></View>
    </Card>
  );
}

function TabBar({ tabs, activeTab, setActiveTab }: { tabs: Array<{ id: WorkspaceTab; label: string }>; activeTab: WorkspaceTab; setActiveTab: (tab: WorkspaceTab) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
      {tabs.map((tab) => <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tab, activeTab === tab.id && styles.tabActive]}><Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text></Pressable>)}
    </ScrollView>
  );
}

function Overview({ mode, setActiveTab, library, tiers }: { mode: string; setActiveTab: (tab: WorkspaceTab) => void; library: LibraryItem[]; tiers: ContentTier[] }) {
  return (
    <>
      <SectionTitle title="Platform overview" action="Organized" />
      <Card style={styles.panel}>
        <View style={styles.statRow}><MiniStat label="Courses" value={String(Math.max(1, library.length))} /><MiniStat label="Tiers" value={String(tiers.length)} /><MiniStat label="Events" value="7" /></View>
        <Feature title="Course Hosting" body="Host structured courses with modules, lessons, resources, quizzes, assignments, and certificates." />
        <Feature title="Smart Drip" body="Unlock lessons by time, quiz score, module completion, assignment approval, or cohort schedule." />
        <Feature title="AI Tutor" body="Every lesson can include an AI tutor grounded in transcripts, course materials, and instructor notes." />
        <Feature title="Analytics and Automation" body="Track progress, engagement, completion, quiz difficulty, webhook events, and learner activity." />
        <PrimaryButton onPress={() => setActiveTab(mode === "dashboard" ? "builder" : "learn")}>{mode === "dashboard" ? "Open Creator Builder" : "Open Learner Dashboard"}</PrimaryButton>
      </Card>
    </>
  );
}

function LearnerDashboard({ library, tiers, setActiveTab }: { library: LibraryItem[]; tiers: ContentTier[]; setActiveTab: (tab: WorkspaceTab) => void }) {
  return (
    <>
      <SectionTitle title="Learner dashboard" action="Student view" />
      <Card style={styles.panel}>
        <View style={styles.statRow}><MiniStat label="Progress" value="42%" /><MiniStat label="Streak" value="5d" /><MiniStat label="XP" value={String(1250 + library.length * 75)} /></View>
        <ProgressBar value={42} />
        <Feature title="Recommended next lesson" body="Continue Module 2: Core Teaching. Complete the practice exercise to unlock the quiz and next content drip." />
        <Feature title="Enrolled courses" body={`${Math.max(1, library.length)} active learning path. Access tiers: ${tiers.map((tier) => tier.name).slice(0, 3).join(", ")}.`} />
        <Feature title="Certificates" body="Certificates unlock automatically after required lessons, quizzes, and assignments are completed." />
        <PrimaryButton onPress={() => setActiveTab("tutor")}>Ask AI Tutor</PrimaryButton>
      </Card>
      <SectionTitle title="Learning path" action="Sequential" />
      <View style={styles.stack}><PathStep number="1" title="Foundation" body="Unlocked. Complete orientation and baseline quiz." complete /><PathStep number="2" title="Core Training" body="Unlocks after Foundation completion." complete={false} /><PathStep number="3" title="Implementation Lab" body="Unlocks after quiz score of 70% or higher." complete={false} /><PathStep number="4" title="Certification" body="Unlocks after final assignment approval." complete={false} /></View>
    </>
  );
}

function CreatorStudio({ library, tiers, selectedTierIds, selectedType, selectedDrip, activeAction, output, isBusy, setSelectedType, setSelectedDrip, toggleTier, addTier, createCourseAsset, transform }: { library: LibraryItem[]; tiers: ContentTier[]; selectedTierIds: string[]; selectedType: LibraryItem["type"]; selectedDrip: string; activeAction: TransformAction; output: string; isBusy: boolean; setSelectedType: (type: LibraryItem["type"]) => void; setSelectedDrip: (drip: string) => void; toggleTier: (id: string) => void; addTier: (name: string) => void; createCourseAsset: () => void; transform: (action?: TransformAction, question?: string, currentLibrary?: LibraryItem[]) => Promise<void> }) {
  return (
    <>
      <SectionTitle title="Creator Studio" action="Course builder" />
      <Card style={styles.panel}>
        <Step number="1" title="Asset type" body="Choose the course asset being uploaded." />
        <ChipRow items={uploadPresets} selected={selectedType} onSelect={(item) => setSelectedType(item as LibraryItem["type"])} />
        <Step number="2" title="Tier access" body="Select who can access this content." />
        <View style={styles.wrap}>{tiers.map((tier) => <Chip key={tier.id} label={tier.name} active={selectedTierIds.includes(tier.id)} onPress={() => toggleTier(tier.id)} />)}</View>
        <View style={styles.wrap}>{tierPresets.map((tier) => <Pressable key={tier} onPress={() => addTier(tier)} style={styles.smallChip}><Text style={styles.smallChipText}>+ {tier}</Text></Pressable>)}</View>
        <Step number="3" title="Drip rule" body="Choose the unlock logic." />
        <View style={styles.stack}>{dripPresets.map((drip) => <Pressable key={drip} onPress={() => setSelectedDrip(drip)} style={[styles.option, selectedDrip === drip && styles.optionActive]}><Text style={[styles.optionText, selectedDrip === drip && styles.optionTextActive]}>{drip}</Text></Pressable>)}</View>
        <PrimaryButton onPress={createCourseAsset} disabled={isBusy}>{isBusy ? "Structuring..." : "Create Course Blueprint"}</PrimaryButton>
      </Card>
      <SectionTitle title="AI course actions" action="Choose output" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>{transformActions.slice(0, 10).map((action, index) => <Pressable key={`${action}-${index}`} onPress={() => transform(action)} style={[styles.actionChip, activeAction === action && styles.actionChipActive]}><Text style={[styles.actionText, activeAction === action && styles.actionTextActive]}>{action}</Text></Pressable>)}</ScrollView>
      <OutputPanel output={output} isBusy={isBusy} />
      <SectionTitle title="Course assets" action={`${library.length} saved`} />
      <View style={styles.stack}>{library.length ? library.map((item) => <LibraryCard key={item.id} item={item} tiers={tiers} />) : <EmptyCard title="No course asset yet" body="Create a course blueprint to see assets here." />}</View>
    </>
  );
}

function AdminDashboard({ tiers, library }: { tiers: ContentTier[]; library: LibraryItem[] }) {
  return (
    <>
      <SectionTitle title="Admin dashboard" action="Separate control center" />
      <Card style={styles.panel}>
        <View style={styles.statRow}><MiniStat label="Users" value="10K+" /><MiniStat label="Courses" value={String(Math.max(1, library.length))} /><MiniStat label="Tiers" value={String(tiers.length)} /></View>
        <Feature title="User and role management" body="Owner, Admin, Instructor, Moderator, and Student permissions are separated for safer operations." />
        <Feature title="Course approvals" body="Review drafts, approve courses, audit lesson changes, and enforce quality standards." />
        <Feature title="Moderation" body="Manage threads, comments, pinned instructor posts, flagged content, bans, and audit logs." />
        <Feature title="Analytics overview" body="Completion rate, engagement, lesson drop-off, quiz difficulty, assignment review time, and certificate issuance." />
      </Card>
      <SectionTitle title="Role permissions" action="RBAC" />
      <View style={styles.stack}><RoleCard role="Owner" body="Full system control, billing, API keys, audit logs." /><RoleCard role="Admin" body="Users, approvals, analytics, moderation." /><RoleCard role="Instructor" body="Courses, lessons, drips, quizzes, students." /><RoleCard role="Moderator" body="Community discussions, flags, bans." /><RoleCard role="Student" body="Learn, submit, complete, earn certificates." /></View>
    </>
  );
}

function AITutor({ output, sources, isBusy, transform }: { output: string; sources: RetrievedSource[]; isBusy: boolean; transform: (action?: TransformAction, question?: string, currentLibrary?: LibraryItem[]) => Promise<void> }) {
  const suggestions: Array<{ label: string; action: TransformAction; prompt: string }> = [
    { label: "Explain lesson", action: "Explain Simply", prompt: "Explain the current lesson concept simply and give examples." },
    { label: "Generate quiz", action: "Generate Quiz", prompt: "Generate a quiz for this lesson with answers and unlock criteria." },
    { label: "Recommend next", action: "Generate Action Plan", prompt: "Recommend the learner's next lesson and action steps." },
    { label: "Create assignment", action: "Create Assignments", prompt: "Create an assignment that proves the learner can apply the lesson." },
  ];
  return (
    <>
      <SectionTitle title="AI Tutor" action="Lesson assistant" />
      <Card style={styles.panel}><Feature title="Grounded help" body="The tutor answers from lesson transcripts, resources, instructor notes, and retrieved course context." /><View style={styles.wrap}>{suggestions.map((item) => <Pressable key={item.label} onPress={() => transform(item.action, item.prompt)} style={styles.smallChip}><Text style={styles.smallChipText}>{item.label}</Text></Pressable>)}</View></Card>
      <OutputPanel output={output} isBusy={isBusy} />
      <SectionTitle title="Tutor sources" action={`${sources.length} references`} />
      <View style={styles.stack}>{sources.length ? sources.map((source) => <RetrievedCard key={`${source.id}-${source.excerpt.slice(0, 10)}`} source={source} />) : <EmptyCard title="No sources yet" body="Create a course asset first so the tutor has context." />}</View>
    </>
  );
}

function CertificatesAndCommunity() {
  return (
    <>
      <SectionTitle title="Certificates" action="Completion rewards" />
      <Card style={styles.panel}><Feature title="Certificate unlock" body="Certificates generate after lesson completion, quiz pass, and final assignment approval." /><Feature title="Verification" body="Each certificate includes student name, course title, completion date, instructor name, and verification code." /></Card>
      <SectionTitle title="Community" action="Course discussions" />
      <Card style={styles.panel}><Feature title="Discussion threads" body="Course threads, comments, likes, pinned instructor posts, moderation, and flagged content support." /><Feature title="Engagement" body="XP, badges, streaks, assignments, and community prompts keep learners active." /></Card>
    </>
  );
}

function AutomationCenter({ clearWorkspace }: { clearWorkspace: () => void }) {
  const events = ["audio_uploaded", "transcript_processed", "course_created", "lesson_completed", "quiz_passed", "assignment_submitted", "certificate_issued"];
  return (
    <>
      <SectionTitle title="Automation Center" action="Webhooks" />
      <Card style={styles.panel}><Feature title="Audio-to-course" body="audio_uploaded triggers transcription, transcript processing, course outline, modules, lessons, summaries, quizzes, and instructor review." /><Feature title="Unlock automation" body="lesson_completed, quiz_passed, and assignment_submitted trigger XP, badges, unlock rules, certificates, analytics, and webhooks." /><View style={styles.wrap}>{events.map((event) => <View key={event} style={styles.smallChip}><Text style={styles.smallChipText}>{event}</Text></View>)}</View></Card>
      <SectionTitle title="Search and realtime" action="Infrastructure" />
      <Card style={styles.panel}><Feature title="Global search" body="Search courses, lessons, transcripts, resources, categories, difficulty, instructors, and completion status." /><Feature title="Realtime-ready" body="The backend blueprint supports WebSocket chat, tutor events, and course community activity streams." /></Card>
      <PrimaryButton style={styles.resetButton} onPress={clearWorkspace}>Clear Test Workspace</PrimaryButton>
    </>
  );
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  return <View style={styles.step}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View><View style={{ flex: 1 }}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepBody}>{body}</Text></View></View>;
}

function Feature({ title, body }: { title: string; body: string }) {
  return <View style={styles.feature}><Text style={styles.featureTitle}>{title}</Text><Text style={styles.featureBody}>{body}</Text></View>;
}

function ChipRow({ items, selected, onSelect }: { items: string[]; selected: string; onSelect: (item: string) => void }) {
  return <View style={styles.wrap}>{items.map((item) => <Chip key={item} label={item} active={selected === item} onPress={() => onSelect(item)} />)}</View>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function OutputPanel({ output, isBusy }: { output: string; isBusy: boolean }) {
  return <><SectionTitle title="Generated output" action="Selectable" /><Card style={styles.outputCard}>{isBusy ? <ActivityIndicator color={colors.primary2} style={{ marginBottom: spacing.md }} /> : null}<Text selectable style={styles.outputText}>{output}</Text></Card></>;
}

function PathStep({ number, title, body, complete }: { number: string; title: string; body: string; complete: boolean }) {
  return <Card style={[styles.pathStep, complete && styles.pathStepComplete]}><View style={styles.row}><View style={[styles.stepNumber, complete && styles.stepNumberComplete]}><Text style={styles.stepNumberText}>{number}</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardBody}>{body}</Text></View><Pill label={complete ? "Done" : "Locked"} tone={complete ? "success" : "warning"} /></View></Card>;
}

function LibraryCard({ item, tiers }: { item: LibraryItem; tiers: ContentTier[] }) {
  const tierNames = tiers.filter((tier) => item.tierIds?.includes(tier.id)).map((tier) => tier.name).join(", ") || "Ungated";
  return <Card style={styles.compactCard}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardMeta}>{item.type} • {formatNumber(item.wordCount)} words</Text></View><Pill label="Interactive" tone="success" /></View><Text style={styles.cardBody}>Tiers: {tierNames}</Text><Text style={styles.cardBody}>Drip: {item.dripRule?.description || "Instant"}</Text></Card>;
}

function RetrievedCard({ source }: { source: RetrievedSource }) {
  return <Card style={styles.compactCard}><Text style={styles.cardTitle}>{source.title}</Text><Text style={styles.cardBody}>{source.excerpt}</Text></Card>;
}

function RoleCard({ role, body }: { role: string; body: string }) {
  return <Card style={styles.compactCard}><Text style={styles.cardTitle}>{role}</Text><Text style={styles.cardBody}>{body}</Text></Card>;
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return <Card style={styles.compactCard}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardBody}>{body}</Text></Card>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <View style={styles.miniStat}><Text style={styles.miniValue}>{value}</Text><Text style={styles.miniLabel}>{label}</Text></View>;
}

function StatusCard({ stage, text, busy }: { stage: ProcessingStage; text: string; busy: boolean }) {
  const tone = stage === "error" ? colors.danger : stage === "ready" ? colors.success : colors.primary2;
  return <Card style={styles.statusCard}><View style={[styles.statusDot, { backgroundColor: tone }]} /><Text style={styles.statusText}>{text}</Text>{busy ? <ActivityIndicator color={colors.primary2} /> : null}</Card>;
}

function ProgressBar({ value }: { value: number }) {
  return <View style={styles.progressOuter}><View style={[styles.progressInner, { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View>;
}

function firstRunOutput(mode: string) {
  if (mode === "dashboard") return `Summary:\nCreator Studio is ready. Build course assets, assign tiers, set drip logic, generate modules, lessons, quizzes, assignments, and automate learner progression.\n\nKey Points:\n1. Creator and admin tools are separated from learner tools.\n2. Course building follows a clean sequence: asset, tier, drip, AI structure.\n3. Admin controls manage users, approvals, analytics, roles, and moderation.\n\nInsights:\nThe app is now organized around roles instead of showing every feature at once.\n\nActionable Output:\nOpen Builder to create a course blueprint or Admin to manage platform operations.`;
  return `Summary:\nLearner Dashboard is ready. Continue courses, track progress, ask the AI tutor, join discussions, and unlock certificates.\n\nKey Points:\n1. Learner tools are separated from creator and admin tools.\n2. Progress, XP, streaks, paths, certificates, and AI help are grouped clearly.\n3. The next best action is always visible.\n\nInsights:\nLearners need a calm dashboard, not a creator control panel.\n\nActionable Output:\nOpen Learn to continue, AI Tutor for help, or Certificates to view rewards.`;
}

function formatNumber(value: number) { if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`; if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`; return String(value); }

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl * 2 },
  hero: { marginBottom: spacing.sm, backgroundColor: "#0B1224" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  heroStat: { color: colors.primary2, fontSize: 12, fontWeight: "900" },
  heroTitle: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: "900", letterSpacing: -0.7, marginTop: spacing.md },
  heroText: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  tabRow: { gap: spacing.sm, paddingVertical: spacing.md },
  tab: { borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: 14, paddingVertical: 10 },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: colors.white },
  panel: { backgroundColor: "#0B1224" },
  statRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  miniStat: { flex: 1, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  miniValue: { color: colors.text, fontWeight: "900", fontSize: 16 },
  miniLabel: { color: colors.faint, fontWeight: "800", fontSize: 10, marginTop: 4, textTransform: "uppercase" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  stack: { gap: spacing.md },
  chip: { borderRadius: 999, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: "rgba(0, 212, 255, 0.13)", borderColor: "rgba(0, 212, 255, 0.45)" },
  chipText: { color: colors.muted, fontWeight: "800", fontSize: 11, textTransform: "capitalize" },
  chipTextActive: { color: colors.primary2 },
  smallChip: { borderRadius: 999, backgroundColor: "rgba(109, 94, 248, 0.12)", paddingHorizontal: 10, paddingVertical: 7 },
  smallChipText: { color: colors.primary2, fontSize: 11, fontWeight: "900" },
  option: { backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  optionActive: { borderColor: colors.primary2, backgroundColor: "rgba(0, 212, 255, 0.1)" },
  optionText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  optionTextActive: { color: colors.text },
  statusCard: { marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  statusDot: { width: 10, height: 10, borderRadius: 10 },
  statusText: { color: colors.muted, flex: 1, fontSize: 13, lineHeight: 18 },
  actionRow: { gap: spacing.sm, paddingBottom: spacing.md },
  actionChip: { paddingHorizontal: spacing.md, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  actionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { color: colors.muted, fontSize: 12, fontWeight: "900" },
  actionTextActive: { color: colors.white },
  outputCard: { backgroundColor: "#0B1020" },
  outputText: { color: colors.text, fontSize: 14, lineHeight: 22 },
  feature: { borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.md, marginTop: spacing.md },
  featureTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  featureBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  compactCard: { padding: spacing.md, backgroundColor: colors.surface },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  cardMeta: { color: colors.primary2, fontSize: 11, fontWeight: "800", marginTop: 4, textTransform: "capitalize" },
  cardBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  resetButton: { marginTop: spacing.xl, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border },
  step: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", marginBottom: spacing.md, marginTop: spacing.sm },
  stepNumber: { width: 30, height: 30, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border },
  stepNumberComplete: { backgroundColor: "rgba(39, 215, 153, 0.2)", borderColor: colors.success },
  stepNumberText: { color: colors.primary2, fontWeight: "900", fontSize: 12 },
  stepTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  stepBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  pathStep: { padding: spacing.md },
  pathStepComplete: { borderColor: colors.success },
  progressOuter: { height: 9, backgroundColor: colors.surface3, borderRadius: 999, overflow: "hidden", marginTop: spacing.md, marginBottom: spacing.md },
  progressInner: { height: 9, backgroundColor: colors.primary2, borderRadius: 999 },
});

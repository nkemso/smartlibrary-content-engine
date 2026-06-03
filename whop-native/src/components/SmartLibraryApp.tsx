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
type WorkspaceTab = "learner" | "creator" | "admin" | "owner" | "ai" | "automation" | "certificates";

const API_FALLBACK = "https://smartlibrary-content-engine.vercel.app";

const tierPresets = ["Free", "Premium", "VIP", "Gold", "Cohort", "Inner Circle", "Masterclass", "Enterprise"];
const uploadPresets: Array<LibraryItem["type"]> = ["course", "video", "file", "audio", "manual", "transcript", "link"];
const dripPresets = [
  "Available immediately",
  "Unlock 3 days after joining",
  "Unlock 7 days after joining",
  "Unlock after previous lesson completion",
  "Unlock after quiz pass",
  "Unlock on scheduled cohort date",
];

const roleCards = [
  { role: "Owner", access: "Full system control, billing, platform settings, audit logs" },
  { role: "Admin", access: "User management, course approvals, analytics, moderation" },
  { role: "Instructor", access: "Course builder, lessons, drip schedules, student tracking" },
  { role: "Moderator", access: "Discussion threads, comments, flagged content, bans" },
  { role: "Student", access: "Enroll, learn, ask AI tutor, submit assignments, earn certificates" },
];

const automationEvents = [
  "audio_uploaded",
  "transcript_processed",
  "course_created",
  "lesson_completed",
  "quiz_passed",
  "assignment_submitted",
  "certificate_issued",
];

const starterCourseAsset = `Creator uploaded a course asset for SmartLibrary processing. The asset should be transformed into a premium learning journey with modules, lessons, exercises, assignments, quizzes, drip rules, tier-gated access, progress tracking, badges, XP, and interactive checkpoints. The creator wants a structure that can serve Whop communities, course creators, coaches, trainers, educators, consultants, ministries, and subscription communities. The output should be practical, polished, copy-ready, and useful immediately.`;

export function SmartLibraryApp(props: SmartLibraryProps) {
  const host = useMemo(() => getHostDetails(), []);
  const userId = props.currentUserId ?? "anonymous";
  const scopeId = props.mode === "experience" ? props.experienceId : props.mode === "dashboard" ? props.companyId : "discover";
  const cacheKey = `smartlibrary:v4:premium:${userId}:${scopeId}`;

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(props.mode === "dashboard" ? "creator" : "learner");
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
  const [stageText, setStageText] = useState("Use the menu to open your workspace.");
  const [output, setOutput] = useState(firstRunOutput());
  const [sources, setSources] = useState<RetrievedSource[]>([]);

  const apiOrigin = host.apiOrigin || API_FALLBACK;
  const totalWords = library.reduce((sum, item) => sum + item.wordCount, 0);
  const isBusy = stage === "retrieving" || stage === "thinking";

  useEffect(() => {
    setNavigationBar("SmartLibrary Content Engine", "Premium AI learning platform");
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
  }, [cacheKey]);

  useEffect(() => {
    cacheSet(cacheKey, JSON.stringify({ library, tiers }));
  }, [cacheKey, library, tiers]);

  function toggleTier(id: string) {
    setSelectedTierIds((current) => (current.includes(id) ? current.filter((tierId) => tierId !== id) : [...current, id]));
  }

  function addTier(name: string) {
    const exists = tiers.some((tier) => tier.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    const tier: ContentTier = {
      id: makeId("tier"),
      name,
      description: `${name} gated content`,
      color: colors.primary2,
    };
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
        type: selectedDrip.includes("after") ? "after_completion" : selectedDrip.includes("days") ? "days_after_join" : selectedDrip.includes("date") ? "date" : "instant",
        description: selectedDrip,
      },
      interactive: true,
      createdAt: new Date().toISOString(),
      wordCount: content.split(/\s+/).length,
    };

    const nextLibrary = [item, ...library].slice(0, 60);
    setLibrary(nextLibrary);
    setActiveTab("creator");
    await transform("Structure Course", buildSuggestedPrompt(item), nextLibrary);
  }

  async function transform(action = activeAction, question = "Structure this course into modules, lessons, exercises, assignments, quizzes, drip logic, tier access, and gamified checkpoints.", currentLibrary = library) {
    setActiveAction(action);
    setStage("retrieving");
    setStageText("Searching course assets before generating output...");

    const retrieved = retrieveRelevantSources(currentLibrary, question || action, 5);
    setSources(retrieved);
    const localOutput = createLocalOutput(action, question || action, retrieved, currentLibrary);
    setOutput(localOutput);

    if (!currentLibrary.length) {
      setStage("ready");
      setStageText("Create an upload blueprint first.");
      return;
    }

    setStage("thinking");
    setStageText("Generating premium learning structure with AI routing...");

    try {
      const response = await fetch(`${apiOrigin}/api/transform`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          question,
          sources: retrieved,
          libraryMeta: currentLibrary.map((item) => ({ id: item.id, title: item.title, type: item.type, wordCount: item.wordCount, tierIds: item.tierIds, dripRule: item.dripRule })),
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { output?: string; provider?: string };
        if (data.output && data.output.trim()) setOutput(data.output.trim());
        setStageText(`Output ready${data.provider ? ` via ${data.provider}` : ""}.`);
      } else {
        setStageText("Output ready using local course structuring fallback.");
      }
      setStage("ready");
    } catch {
      setStage("ready");
      setStageText("Output ready using local course structuring fallback.");
    }
  }

  function clearWorkspace() {
    setLibrary([]);
    setSources([]);
    setOutput(firstRunOutput());
    setStage("idle");
    setStageText("Workspace cleared. Create a new upload blueprint.");
  }

  return (
    <Shell>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header title="DASHBOARD" subtitle="Tap the dashboard menu to navigate" badge={props.mode === "dashboard" ? "Admin" : "Native"} />

        <WorkspaceMenu mode={props.mode} activeTab={activeTab} setActiveTab={setActiveTab} libraryCount={library.length} tierCount={tiers.length} />
        <ActiveDashboardMenus activeTab={activeTab} setActiveTab={setActiveTab} />
        <StatusCard stage={stage} text={stageText} busy={isBusy} />

        {activeTab === "learner" ? (
          <LearnerDashboard library={library} tiers={tiers} setActiveTab={setActiveTab} />
        ) : activeTab === "creator" ? (
          <CreatorStudio
            library={library}
            tiers={tiers}
            selectedTierIds={selectedTierIds}
            selectedType={selectedType}
            selectedDrip={selectedDrip}
            activeAction={activeAction}
            sources={sources}
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
        ) : activeTab === "owner" ? (
          <OwnerDashboard />
        ) : activeTab === "ai" ? (
          <AITutorWorkspace output={output} sources={sources} isBusy={isBusy} transform={transform} />
        ) : activeTab === "certificates" ? (
          <CertificatesAndCommunity />
        ) : (
          <AutomationCenter clearWorkspace={clearWorkspace} />
        )}
      </ScrollView>
    </Shell>
  );
}

function Hero({ libraryCount, tierCount, totalWords, mode }: { libraryCount: number; tierCount: number; totalWords: number; mode: string }) {
  return (
    <Card style={styles.hero}>
      <View style={styles.heroTop}>
        <Pill label="Premium SaaS MVP" tone="success" />
        <Text style={styles.heroStat}>{libraryCount} assets</Text>
      </View>
      <Text style={styles.heroTitle}>Host courses, automate learning, and power every lesson with AI</Text>
      <Text style={styles.heroText}>
        A structured learning platform for creators: course builder, smart drip, AI tutor, quizzes, assignments, certificates, community, analytics, and tier-gated access.
      </Text>
      <View style={styles.statRow}>
        <MiniStat label="Words" value={formatNumber(totalWords)} />
        <MiniStat label="Tiers" value={String(tierCount)} />
        <MiniStat label="Mode" value={mode} />
      </View>
    </Card>
  );
}

function WorkspaceMenu({ mode, activeTab, setActiveTab, libraryCount, tierCount }: { mode: SmartLibraryProps["mode"]; activeTab: WorkspaceTab; setActiveTab: (tab: WorkspaceTab) => void; libraryCount: number; tierCount: number }) {
  const [open, setOpen] = useState(false);
  const items = getWorkspaceItems(mode);
  const active = items.find((item) => item.id === activeTab) || items[0];

  function choose(tab: WorkspaceTab) {
    setActiveTab(tab);
    setOpen(false);
  }

  return (
    <Card style={styles.menuCard}>
      <Pressable onPress={() => setOpen(!open)} style={styles.menuButton}>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuLabel}>DASHBOARD</Text>
          <Text style={styles.menuTitle}>{active?.label || "Dashboard"}</Text>
          <Text style={styles.menuDescription}>{active?.description || "Open a workspace"}</Text>
          <View style={styles.dashboardStats}>
            <Text style={styles.dashboardStat}>{libraryCount} assets</Text>
            <Text style={styles.dashboardStat}>{tierCount} tiers</Text>
          </View>
        </View>
        <Text style={styles.menuChevron}>{open ? "×" : "⌄"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.menuList}>
          {items.map((item) => (
            <Pressable key={item.id} onPress={() => choose(item.id)} style={[styles.menuItem, activeTab === item.id && styles.menuItemActive]}>
              <Text style={[styles.menuItemTitle, activeTab === item.id && styles.menuItemTitleActive]}>{item.label}</Text>
              <Text style={styles.menuItemDescription}>{item.description}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}


function ActiveDashboardMenus({ activeTab, setActiveTab }: { activeTab: WorkspaceTab; setActiveTab: (tab: WorkspaceTab) => void }) {
  const menus = getSubMenus(activeTab);
  return (
    <Card style={styles.subMenuCard}>
      <View style={styles.subMenuHeader}>
        <Text style={styles.subMenuTitle}>Menu</Text>
        <Text style={styles.subMenuActive}>{getDashboardName(activeTab)}</Text>
      </View>
      <View style={styles.subMenuGrid}>
        {menus.map((menu) => (
          <Pressable key={menu.label} onPress={() => menu.goTo ? setActiveTab(menu.goTo) : undefined} style={styles.subMenuItem}>
            <Text style={styles.subMenuItemTitle}>{menu.label}</Text>
            <Text style={styles.subMenuItemText}>{menu.text}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

function getDashboardName(tab: WorkspaceTab) {
  if (tab === "learner") return "User Dashboard";
  if (tab === "creator") return "Creator Studio";
  if (tab === "admin") return "Admin Dashboard";
  if (tab === "owner") return "Owner Super Admin";
  if (tab === "ai") return "AI Tutor";
  if (tab === "certificates") return "Certificates";
  return "Automation";
}

function getSubMenus(tab: WorkspaceTab): Array<{ label: string; text: string; goTo?: WorkspaceTab }> {
  if (tab === "learner") {
    return [
      { label: "Courses", text: "Enrolled courses" },
      { label: "Progress", text: "Streaks and XP" },
      { label: "Path", text: "Next lessons" },
      { label: "AI Tutor", text: "Ask for help", goTo: "ai" },
      { label: "Certificates", text: "Rewards", goTo: "certificates" },
    ];
  }
  if (tab === "creator") {
    return [
      { label: "Upload", text: "Course assets" },
      { label: "Builder", text: "Modules/lessons" },
      { label: "Tiers", text: "Gate content" },
      { label: "Drip", text: "Unlock rules" },
      { label: "Publish", text: "Go live" },
      { label: "AI Tutor", text: "Course assistant", goTo: "ai" },
    ];
  }
  if (tab === "admin") {
    return [
      { label: "Users", text: "Roles/access" },
      { label: "Courses", text: "Approvals" },
      { label: "Moderation", text: "Community" },
      { label: "Analytics", text: "Engagement" },
      { label: "Settings", text: "Workspace" },
      { label: "Owner", text: "Platform", goTo: "owner" },
    ];
  }
  if (tab === "owner") {
    return [
      { label: "Downloads", text: "App installs" },
      { label: "Usage", text: "Active users" },
      { label: "Health", text: "System uptime" },
      { label: "Costs", text: "AI/storage" },
      { label: "Privacy", text: "No creator content" },
    ];
  }
  if (tab === "ai") {
    return [
      { label: "Explain", text: "Lesson help" },
      { label: "Quiz", text: "Generate quiz" },
      { label: "Next", text: "Recommend lesson" },
      { label: "Assignment", text: "Create task" },
    ];
  }
  if (tab === "certificates") {
    return [
      { label: "Certificates", text: "Download" },
      { label: "Badges", text: "Rewards" },
      { label: "Community", text: "Discuss" },
      { label: "Verification", text: "Codes" },
    ];
  }
  return [
    { label: "Webhooks", text: "Events" },
    { label: "Audio", text: "To course" },
    { label: "Unlocks", text: "Rules" },
    { label: "Search", text: "Global" },
  ];
}

function getWorkspaceItems(mode: SmartLibraryProps["mode"]): Array<{ id: WorkspaceTab; label: string; description: string }> {
  if (mode === "experience") {
    return [
      { id: "learner", label: "User Dashboard", description: "Courses, progress, streaks, certificates and your learning path" },
      { id: "ai", label: "AI Tutor", description: "Ask questions and get help from course materials" },
      { id: "certificates", label: "Certificates & Community", description: "Rewards, discussions, badges and completion status" },
    ];
  }

  if (mode === "dashboard") {
    return [
      { id: "learner", label: "User Dashboard", description: "Preview the student experience without exposing creator settings" },
      { id: "creator", label: "Creator Studio", description: "Upload, publish, gate, drip and structure course content" },
      { id: "admin", label: "Admin Dashboard", description: "Manage users, courses, moderation and analytics" },
      { id: "owner", label: "Owner Super Admin", description: "App downloads, usage, health and platform analytics only" },
      { id: "automation", label: "Automation", description: "Webhooks, audio-to-course, unlock rules and realtime workflows" },
      { id: "ai", label: "AI Tutor", description: "Preview AI learning assistant behavior" },
    ];
  }

  return [
    { id: "learner", label: "User Dashboard", description: "Preview learner-facing course experience" },
    { id: "creator", label: "Creator Studio", description: "Preview creator course-building features" },
    { id: "ai", label: "AI Tutor", description: "Preview intelligent learning assistant" },
  ];
}

function LearnerDashboard({ library, tiers, setActiveTab }: { library: LibraryItem[]; tiers: ContentTier[]; setActiveTab: (tab: WorkspaceTab) => void }) {
  return (
    <>
      <SectionTitle title="User dashboard" action="Learner only" />
      <Card style={styles.onboardingCard}>
        <Pill label="Welcome to your learning hub" tone="success" />
        <Text style={styles.onboardingTitle}>Your courses, progress, tutor, community and certificates live here.</Text>
        <Text style={styles.onboardingText}>No creator settings. No admin clutter. Just the next best action for your learning journey.</Text>
      </Card>
      <Card style={styles.platformCard}>
        <View style={styles.statRow}>
          <MiniStat label="Progress" value="42%" />
          <MiniStat label="Streak" value="5d" />
          <MiniStat label="XP" value={String(1250 + library.length * 75)} />
        </View>
        <ProgressBar value={42} />
        <DashboardBlock title="Recommended next lesson" body="Continue Module 2: Core Teaching. Complete the practice exercise to unlock the quiz and next content drip." />
        <DashboardBlock title="Enrolled courses" body={`${Math.max(1, library.length)} active learning path${library.length === 1 ? "" : "s"}. Premium tier access: ${tiers.map((tier) => tier.name).slice(0, 4).join(", ")}.`} />
        <DashboardBlock title="Certificates" body="Certificates unlock automatically after required lessons, quizzes, and assignments are completed." />
        <PrimaryButton onPress={() => setActiveTab("ai")}>Ask AI Tutor</PrimaryButton>
      </Card>

      <SectionTitle title="Learning path" action="Sequenced journey" />
      <View style={styles.sourceList}>
        <PathStep number="1" title="Foundation Course" body="Unlocked. Complete orientation and baseline quiz." complete />
        <PathStep number="2" title="Core Training" body="Unlocks after Foundation completion." complete={false} />
        <PathStep number="3" title="Implementation Lab" body="Unlocks after quiz score of 70% or higher." complete={false} />
        <PathStep number="4" title="Certification" body="Unlocks after final assignment approval." complete={false} />
      </View>
    </>
  );
}

function CreatorStudio({
  library,
  tiers,
  selectedTierIds,
  selectedType,
  selectedDrip,
  activeAction,
  sources,
  output,
  isBusy,
  setSelectedType,
  setSelectedDrip,
  toggleTier,
  addTier,
  createCourseAsset,
  transform,
}: {
  library: LibraryItem[];
  tiers: ContentTier[];
  selectedTierIds: string[];
  selectedType: LibraryItem["type"];
  selectedDrip: string;
  activeAction: TransformAction;
  sources: RetrievedSource[];
  output: string;
  isBusy: boolean;
  setSelectedType: (type: LibraryItem["type"]) => void;
  setSelectedDrip: (drip: string) => void;
  toggleTier: (id: string) => void;
  addTier: (name: string) => void;
  createCourseAsset: () => void;
  transform: (action?: TransformAction, question?: string, currentLibrary?: LibraryItem[]) => Promise<void>;
}) {
  return (
    <>
      <SectionTitle title="Creator studio" action="Course builder" />
      <Card style={styles.studioCard}>
        <StepHeader number="1" title="Select upload asset" body="Choose the course file type. Native file storage comes next; this crash-safe build keeps selection stable." />
        <View style={styles.typeRow}>
          {uploadPresets.map((type) => (
            <Pressable key={type} onPress={() => setSelectedType(type)} style={[styles.typeChip, selectedType === type && styles.typeChipActive]}>
              <Text style={[styles.typeChipText, selectedType === type && styles.typeChipTextActive]}>{type}</Text>
            </Pressable>
          ))}
        </View>

        <StepHeader number="2" title="Gate by unlimited tiers" body="Create and assign creator-named tier categories." />
        <View style={styles.typeRow}>
          {tiers.map((tier) => (
            <Pressable key={tier.id} onPress={() => toggleTier(tier.id)} style={[styles.typeChip, selectedTierIds.includes(tier.id) && styles.typeChipActive]}>
              <Text style={[styles.typeChipText, selectedTierIds.includes(tier.id) && styles.typeChipTextActive]}>{tier.name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.typeRow}>
          {tierPresets.map((tier) => (
            <Pressable key={tier} onPress={() => addTier(tier)} style={styles.smallChip}>
              <Text style={styles.smallChipText}>+ {tier}</Text>
            </Pressable>
          ))}
        </View>

        <StepHeader number="3" title="Apply smart drip" body="Use time-based or conditional unlock logic." />
        <View style={styles.sourceList}>
          {dripPresets.map((drip) => (
            <Pressable key={drip} onPress={() => setSelectedDrip(drip)} style={[styles.dripCard, selectedDrip === drip && styles.dripCardActive]}>
              <Text style={[styles.dripText, selectedDrip === drip && styles.dripTextActive]}>{drip}</Text>
            </Pressable>
          ))}
        </View>

        <PrimaryButton onPress={createCourseAsset} disabled={isBusy}>{isBusy ? "Structuring..." : "Create Upload Blueprint"}</PrimaryButton>
      </Card>

      <SectionTitle title="AI course actions" action="Finished outputs" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
        {transformActions.slice(0, 12).map((action, index) => (
          <Pressable key={`${action}-${index}`} onPress={() => transform(action)} style={[styles.actionChip, activeAction === action && styles.actionChipActive]}>
            <Text style={[styles.actionText, activeAction === action && styles.actionTextActive]}>{action}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionTitle title="Generated course blueprint" action="Selectable" />
      <Card style={styles.outputCard}>
        {isBusy ? <ActivityIndicator color={colors.primary2} style={{ marginBottom: spacing.md }} /> : null}
        <Text selectable style={styles.outputText}>{output}</Text>
      </Card>

      <SectionTitle title="Upload assets" action={`${library.length} saved`} />
      <View style={styles.sourceList}>{library.length ? library.map((item) => <LibraryCard key={item.id} item={item} tiers={tiers} />) : <OnboardingCard />}</View>

      <SectionTitle title="Retrieved sources" action={`${sources.length} used`} />
      <View style={styles.sourceList}>{sources.length ? sources.map((source) => <RetrievedCard key={`${source.id}-${source.excerpt.slice(0, 10)}`} source={source} />) : <EmptySourceCard />}</View>
    </>
  );
}

function AdminDashboard({ tiers, library }: { tiers: ContentTier[]; library: LibraryItem[] }) {
  return (
    <>
      <SectionTitle title="Admin dashboard" action="Operations" />
      <Card style={styles.platformCard}>
        <View style={styles.statRow}>
          <MiniStat label="Users" value="10K+" />
          <MiniStat label="Courses" value={String(Math.max(1, library.length))} />
          <MiniStat label="Tiers" value={String(tiers.length)} />
        </View>
        <DashboardBlock title="User management" body="Owners and admins manage users, roles, instructors, moderators, students, and tier access." />
        <DashboardBlock title="Course approvals" body="Review draft courses, approve published courses, audit lesson changes, and enforce content quality." />
        <DashboardBlock title="Moderation" body="Moderate discussions, pin instructor posts, flag comments, delete abuse, and ban users when required." />
        <DashboardBlock title="Analytics overview" body="Track completion rates, lesson drop-off, engagement, quiz difficulty, assignment approval time, and certificate issuance." />
      </Card>

      <SectionTitle title="Role permissions" action="RBAC" />
      <View style={styles.sourceList}>{roleCards.map((item) => <RoleCard key={item.role} role={item.role} access={item.access} />)}</View>
    </>
  );
}


function OwnerDashboard() {
  return (
    <>
      <SectionTitle title="Owner super admin" action="Platform-only" />
      <Card style={styles.ownerCard}>
        <View style={styles.statRow}>
          <MiniStat label="Downloads" value="2.4K" />
          <MiniStat label="Active" value="1.1K" />
          <MiniStat label="Health" value="99%" />
        </View>
        <DashboardBlock title="Platform analytics" body="Track app installs, active users, retention, API usage, build health, model routing, webhook volume, and overall product growth." />
        <DashboardBlock title="Privacy boundary" body="Owner super admin can monitor app usage and infrastructure health, but cannot access creators' private course content or student submissions." />
        <DashboardBlock title="Business controls" body="Manage global plans, platform settings, abuse reports, uptime, model costs, storage growth, and feature adoption." />
      </Card>
    </>
  );
}

function CertificatesAndCommunity() {
  return (
    <>
      <SectionTitle title="Certificates" action="Rewards" />
      <Card style={styles.platformCard}>
        <View style={styles.statRow}>
          <MiniStat label="Badges" value="3" />
          <MiniStat label="Ready" value="1" />
          <MiniStat label="Code" value="Yes" />
        </View>
        <DashboardBlock title="Downloadable certificates" body="Certificates include student name, course title, completion date, instructor name and verification code." />
        <DashboardBlock title="Completion requirements" body="Unlock certificates after required lessons, quiz score, assignment approval and course completion." />
      </Card>
      <SectionTitle title="Community" action="Course space" />
      <Card style={styles.platformCard}>
        <DashboardBlock title="Discussion threads" body="Students can participate in discussions, comments, likes and pinned instructor prompts." />
        <DashboardBlock title="Safe moderation" body="Moderators can flag content, remove harmful posts and keep learning communities focused." />
      </Card>
    </>
  );
}

function AITutorWorkspace({ output, sources, isBusy, transform }: { output: string; sources: RetrievedSource[]; isBusy: boolean; transform: (action?: TransformAction, question?: string, currentLibrary?: LibraryItem[]) => Promise<void> }) {
  const suggestions: Array<{ label: string; action: TransformAction; prompt: string }> = [
    { label: "Explain lesson", action: "Explain Simply", prompt: "Explain the current lesson concept simply and give examples." },
    { label: "Generate quiz", action: "Generate Quiz", prompt: "Generate a quiz for this lesson with answers and unlock criteria." },
    { label: "Recommend next", action: "Generate Action Plan", prompt: "Recommend the learner's next lesson and action steps." },
    { label: "Create assignment", action: "Create Assignments", prompt: "Create an assignment that proves the learner can apply the lesson." },
  ];
  return (
    <>
      <SectionTitle title="AI tutor" action="Every lesson" />
      <Card style={styles.platformCard}>
        <Text style={styles.platformTitle}>Tutor capabilities</Text>
        <Text style={styles.sourceExcerpt}>Answer student questions, explain concepts, summarize lessons, generate quizzes, recommend the next lesson, and ground responses in transcripts, course materials, and instructor notes.</Text>
        <View style={styles.typeRow}>{suggestions.map((item) => <Pressable key={item.label} onPress={() => transform(item.action, item.prompt)} style={styles.smallChip}><Text style={styles.smallChipText}>{item.label}</Text></Pressable>)}</View>
      </Card>

      <SectionTitle title="Tutor output" action="Copy-ready" />
      <Card style={styles.outputCard}>{isBusy ? <ActivityIndicator color={colors.primary2} style={{ marginBottom: spacing.md }} /> : null}<Text selectable style={styles.outputText}>{output}</Text></Card>

      <SectionTitle title="Tutor sources" action={`${sources.length} references`} />
      <View style={styles.sourceList}>{sources.length ? sources.map((source) => <RetrievedCard key={`${source.id}-${source.excerpt.slice(0, 10)}`} source={source} />) : <EmptySourceCard />}</View>
    </>
  );
}

function AutomationCenter({ clearWorkspace }: { clearWorkspace: () => void }) {
  return (
    <>
      <SectionTitle title="Automation center" action="Webhooks" />
      <Card style={styles.platformCard}>
        <Text style={styles.platformTitle}>Learning automation events</Text>
        <View style={styles.typeRow}>{automationEvents.map((event) => <View key={event} style={styles.smallChip}><Text style={styles.smallChipText}>{event}</Text></View>)}</View>
        <DashboardBlock title="Audio-to-course engine" body="audio_uploaded triggers transcription, transcript processing, course outline generation, module creation, lesson summaries, quizzes, and instructor review." />
        <DashboardBlock title="Progression automation" body="lesson_completed, quiz_passed, and assignment_submitted trigger XP, badges, unlock rules, certificates, analytics, and webhook delivery." />
        <DashboardBlock title="Global search" body="Search across courses, lessons, transcripts, resources, categories, difficulty levels, instructors, and completion status." />
      </Card>

      <SectionTitle title="Certificates and community" action="Engagement" />
      <Card style={styles.platformCard}>
        <DashboardBlock title="Certificates" body="Generate downloadable certificates with student name, course title, instructor name, completion date, and verification code." />
        <DashboardBlock title="Community" body="Course discussion threads, comments, likes, pinned instructor posts, moderation, flagged content, and role-based controls." />
        <DashboardBlock title="Realtime-ready" body="The backend blueprint includes WebSocket-ready realtime chat, tutor events, and community activity streams." />
      </Card>
      <PrimaryButton style={styles.resetButton} onPress={clearWorkspace}>Clear Test Workspace</PrimaryButton>
    </>
  );
}

function StepHeader({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View>
      <View style={{ flex: 1 }}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepBody}>{body}</Text></View>
    </View>
  );
}

function DashboardBlock({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <Text style={styles.blockBody}>{body}</Text>
    </View>
  );
}

function RoleCard({ role, access }: { role: string; access: string }) {
  return (
    <Card style={styles.roleCard}>
      <Text style={styles.sourceTitle}>{role}</Text>
      <Text style={styles.sourceExcerpt}>{access}</Text>
    </Card>
  );
}

function PathStep({ number, title, body, complete }: { number: string; title: string; body: string; complete: boolean }) {
  return (
    <Card style={[styles.pathStep, complete && styles.pathStepComplete]}>
      <View style={styles.libraryTop}>
        <View style={[styles.stepNumber, complete && styles.stepNumberComplete]}><Text style={styles.stepNumberText}>{number}</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.sourceTitle}>{title}</Text><Text style={styles.sourceExcerpt}>{body}</Text></View>
        <Pill label={complete ? "Done" : "Locked"} tone={complete ? "success" : "warning"} />
      </View>
    </Card>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressOuter}><View style={[styles.progressInner, { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function StatusCard({ stage, text, busy }: { stage: ProcessingStage; text: string; busy: boolean }) {
  const tone = stage === "error" ? colors.danger : stage === "ready" ? colors.success : colors.primary2;
  return (
    <Card style={styles.statusCard}>
      <View style={[styles.statusDot, { backgroundColor: tone }]} />
      <Text style={styles.statusText}>{text}</Text>
      {busy ? <ActivityIndicator color={colors.primary2} /> : null}
    </Card>
  );
}

function RetrievedCard({ source }: { source: RetrievedSource }) {
  return (
    <Card style={styles.retrievedCard}>
      <Text style={styles.sourceTitle}>{source.title}</Text>
      <Text style={styles.sourceExcerpt}>{source.excerpt}</Text>
    </Card>
  );
}

function LibraryCard({ item, tiers }: { item: LibraryItem; tiers: ContentTier[] }) {
  const tierNames = tiers.filter((tier) => item.tierIds?.includes(tier.id)).map((tier) => tier.name).join(", ") || "Ungated";
  return (
    <Card style={styles.libraryCard}>
      <View style={styles.libraryTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sourceTitle}>{item.title}</Text>
          <Text style={styles.sourceMeta}>{item.type} • {formatNumber(item.wordCount)} words</Text>
        </View>
        <Pill label="Interactive" tone="success" />
      </View>
      <Text style={styles.sourceExcerpt}>Tiers: {tierNames}</Text>
      <Text style={styles.sourceExcerpt}>Drip: {item.dripRule?.description || "Available immediately"}</Text>
    </Card>
  );
}

function EmptySourceCard() {
  return (
    <Card><Text style={styles.sourceTitle}>No retrieved source yet</Text><Text style={styles.sourceExcerpt}>SmartLibrary will search course assets before generating structured learning outputs.</Text></Card>
  );
}

function OnboardingCard() {
  return (
    <Card><Text style={styles.sourceTitle}>Create a course upload blueprint</Text><Text style={styles.sourceExcerpt}>Choose upload type, tiers, and drip logic. Then generate course modules, lessons, exercises, assignments, quizzes, and gamified checkpoints.</Text></Card>
  );
}

function firstRunOutput() {
  return `Summary:\nSmartLibrary is now organized as a premium AI learning platform with separate learner, creator, admin, AI tutor, and automation workspaces.\n\nKey Points:\n1. Learners get progress, streaks, recommended lessons, learning paths, certificates, and AI tutor access.\n2. Creators get course asset upload blueprints, tier gating, drip logic, course structuring, quizzes, assignments, and interactive lessons.\n3. Admins get role management, course approvals, moderation, analytics, audit logs, and platform operations.\n4. Automation supports audio-to-course, transcript processing, lesson completion, quiz pass, assignment submission, and certificate events.\n\nInsights:\nThe app now feels more like a complete SaaS learning system instead of a collection of disconnected tools.\n\nActionable Output:\nOpen Creator Studio to create a course upload blueprint, or open Learner Dashboard to view the student experience.`;
}

function formatNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl * 2 },
  hero: { marginBottom: spacing.sm, backgroundColor: "#0B1224" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  heroStat: { color: colors.primary2, fontSize: 12, fontWeight: "900" },
  heroTitle: { color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8, marginTop: spacing.md },
  heroText: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  menuCard: {
    marginBottom: spacing.md,
    backgroundColor: "#0B1224",
    borderColor: "rgba(0, 212, 255, 0.22)",
  },
  menuButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  menuLabel: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  menuTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },
  menuDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  dashboardStats: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dashboardStat: {
    color: colors.primary2,
    fontSize: 11,
    fontWeight: "900",
  },
  menuChevron: {
    color: colors.primary2,
    fontSize: 28,
    fontWeight: "900",
  },
  menuList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  menuItem: {
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  menuItemActive: {
    borderColor: colors.primary2,
    backgroundColor: "rgba(0, 212, 255, 0.09)",
  },
  menuItemTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  menuItemTitleActive: {
    color: colors.primary2,
  },
  menuItemDescription: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  subMenuCard: {
    marginBottom: spacing.md,
    backgroundColor: "#090F1F",
  },
  subMenuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  subMenuTitle: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  subMenuActive: {
    color: colors.primary2,
    fontSize: 12,
    fontWeight: "900",
  },
  subMenuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  subMenuItem: {
    width: "48%",
    minHeight: 74,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  subMenuItemTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  subMenuItemText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 5,
  },
  onboardingCard: {
    backgroundColor: "#101A33",
    marginBottom: spacing.md,
  },
  onboardingTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25,
    marginTop: spacing.md,
  },
  onboardingText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  ownerCard: {
    backgroundColor: "#11162A",
    borderColor: colors.warning,
  },
  tabRow: { gap: spacing.sm, paddingVertical: spacing.md },
  tab: { borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: 14, paddingVertical: 10 },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: colors.white },
  statRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  miniStat: { flex: 1, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  miniValue: { color: colors.text, fontWeight: "900", fontSize: 16 },
  miniLabel: { color: colors.faint, fontWeight: "800", fontSize: 10, marginTop: 4, textTransform: "uppercase" },
  platformCard: { backgroundColor: "#0B1224" },
  platformTitle: { color: colors.text, fontSize: 15, fontWeight: "900", marginTop: spacing.sm },
  studioCard: { backgroundColor: "#0C1428" },
  label: { color: colors.muted, fontSize: 12, fontWeight: "800", marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.7 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  typeChip: { borderRadius: 999, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: 12, paddingVertical: 8 },
  typeChipActive: { backgroundColor: "rgba(0, 212, 255, 0.13)", borderColor: "rgba(0, 212, 255, 0.45)" },
  typeChipText: { color: colors.muted, fontWeight: "800", fontSize: 11, textTransform: "capitalize" },
  typeChipTextActive: { color: colors.primary2 },
  smallChip: { borderRadius: 999, backgroundColor: "rgba(109, 94, 248, 0.12)", paddingHorizontal: 10, paddingVertical: 7 },
  smallChipText: { color: colors.primary2, fontSize: 11, fontWeight: "900" },
  dripCard: { backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  dripCardActive: { borderColor: colors.primary2, backgroundColor: "rgba(0, 212, 255, 0.1)" },
  dripText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  dripTextActive: { color: colors.text },
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
  sourceList: { gap: spacing.md },
  retrievedCard: { padding: spacing.md },
  sourceTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  sourceMeta: { color: colors.primary2, fontSize: 11, fontWeight: "800", marginTop: 4, textTransform: "capitalize" },
  sourceExcerpt: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  libraryCard: { padding: spacing.md },
  libraryTop: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  resetButton: { marginTop: spacing.xl, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border },
  stepHeader: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", marginBottom: spacing.md, marginTop: spacing.sm },
  stepNumber: { width: 30, height: 30, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border },
  stepNumberComplete: { backgroundColor: "rgba(39, 215, 153, 0.2)", borderColor: colors.success },
  stepNumberText: { color: colors.primary2, fontWeight: "900", fontSize: 12 },
  stepTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  stepBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  block: { borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.md, marginTop: spacing.md },
  blockTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  blockBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  roleCard: { padding: spacing.md, backgroundColor: colors.surface },
  pathStep: { padding: spacing.md },
  pathStepComplete: { borderColor: colors.success },
  progressOuter: { height: 9, backgroundColor: colors.surface3, borderRadius: 999, overflow: "hidden", marginTop: spacing.md, marginBottom: spacing.md },
  progressInner: { height: 9, backgroundColor: colors.primary2, borderRadius: 999 },
});

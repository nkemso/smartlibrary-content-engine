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

const platformCapabilities = [
  "Drag-and-drop course builder blueprint",
  "Modules, lessons, resources, quizzes, assignments",
  "AI tutor attached to every lesson",
  "Audio-to-course automation workflow",
  "Learning paths with course sequence unlocks",
  "Certificates with verification codes",
  "Course community and moderation",
  "Analytics for completion, engagement, quiz difficulty",
  "Global search across courses, lessons, transcripts, and resources",
  "Webhook automation for learning events",
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
  const cacheKey = `smartlibrary:v3:safe:${userId}:${scopeId}`;

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
  const [stageText, setStageText] = useState("Choose upload settings, create tiers, then generate a course structure.");
  const [output, setOutput] = useState(firstRunOutput());
  const [sources, setSources] = useState<RetrievedSource[]>([]);

  const apiOrigin = host.apiOrigin || API_FALLBACK;
  const totalWords = library.reduce((sum, item) => sum + item.wordCount, 0);

  useEffect(() => {
    setNavigationBar("SmartLibrary Content Engine", "Courses, tiers, drip, AI structure");
    const cached = cacheGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { library?: LibraryItem[]; tiers?: ContentTier[] };
        if (Array.isArray(parsed.library)) setLibrary(parsed.library);
        if (Array.isArray(parsed.tiers)) setTiers(parsed.tiers);
      } catch {
        setStageText("Workspace ready. Choose upload settings to begin.");
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
    const assetTitle = `${selectedType.charAt(0).toUpperCase()}${selectedType.slice(1)} Upload Blueprint`;
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
    setStageText("Generating course structure with AI routing...");

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
        setStageText(`Output ready${data.provider ? ` via ${data.provider}` : ""}. Copy, share, refine, or choose another action.`);
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

  const isBusy = stage === "retrieving" || stage === "thinking";

  return (
    <Shell>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header title="SmartLibrary" subtitle="Course upload, tier gating, drip and AI structure" badge={props.mode === "dashboard" ? "Admin" : "Native"} />

        <Card style={styles.hero}>
          <View style={styles.heroTop}>
            <Pill label="Crash-safe creator console" tone="success" />
            <Text style={styles.heroStat}>{library.length} assets</Text>
          </View>
          <Text style={styles.heroTitle}>Build premium gated courses from uploaded assets</Text>
          <Text style={styles.heroText}>
            Choose asset type, assign custom tiers, set drip logic, then generate modules, lessons, assignments, quizzes, and gamified checkpoints.
          </Text>
          <View style={styles.statRow}>
            <MiniStat label="Words" value={formatNumber(totalWords)} />
            <MiniStat label="Tiers" value={String(tiers.length)} />
            <MiniStat label="Mode" value={props.mode} />
          </View>
        </Card>

        <GamificationPanel libraryCount={library.length} tierCount={tiers.length} />

        <PremiumPlatformOverview />
        <RolePermissionMatrix />

        <SectionTitle title="1. Upload asset type" action="No typing needed" />
        <Card>
          <Text style={styles.label}>Choose the asset the creator is uploading</Text>
          <View style={styles.typeRow}>
            {uploadPresets.map((type) => (
              <Pressable key={type} onPress={() => setSelectedType(type)} style={[styles.typeChip, selectedType === type && styles.typeChipActive]}>
                <Text style={[styles.typeChipText, selectedType === type && styles.typeChipTextActive]}>{type}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helperText}>
            Stable mode avoids native text-input crashes. The next backend upgrade should connect this to Whop/Vercel Blob/Supabase/S3 file upload.
          </Text>
        </Card>

        <SectionTitle title="2. Unlimited tiers" action="Creator-defined" />
        <Card>
          <Text style={styles.label}>Selected tiers gate who can access this upload</Text>
          <View style={styles.typeRow}>
            {tiers.map((tier) => (
              <Pressable key={tier.id} onPress={() => toggleTier(tier.id)} style={[styles.typeChip, selectedTierIds.includes(tier.id) && styles.typeChipActive]}>
                <Text style={[styles.typeChipText, selectedTierIds.includes(tier.id) && styles.typeChipTextActive]}>{tier.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Add common tier names</Text>
          <View style={styles.typeRow}>
            {tierPresets.map((tier) => (
              <Pressable key={tier} onPress={() => addTier(tier)} style={styles.smallChip}>
                <Text style={styles.smallChipText}>+ {tier}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <SectionTitle title="3. Drip logic" action="Time or condition" />
        <Card>
          <View style={styles.sourceList}>
            {dripPresets.map((drip) => (
              <Pressable key={drip} onPress={() => setSelectedDrip(drip)} style={[styles.dripCard, selectedDrip === drip && styles.dripCardActive]}>
                <Text style={[styles.dripText, selectedDrip === drip && styles.dripTextActive]}>{drip}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <StatusCard stage={stage} text={stageText} busy={isBusy} />

        <SectionTitle title="4. Generate course intelligence" action="RAG first" />
        <Card>
          <PrimaryButton onPress={createCourseAsset} disabled={isBusy}>
            {isBusy ? "Structuring..." : "Create Upload Blueprint"}
          </PrimaryButton>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
            {transformActions.slice(0, 12).map((action, index) => (
              <Pressable key={`${action}-${index}`} onPress={() => transform(action)} style={[styles.actionChip, activeAction === action && styles.actionChipActive]}>
                <Text style={[styles.actionText, activeAction === action && styles.actionTextActive]}>{action}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Card>

        <SectionTitle title="Finished output" action="Selectable" />
        <Card style={styles.outputCard}>
          {isBusy ? <ActivityIndicator color={colors.primary2} style={{ marginBottom: spacing.md }} /> : null}
          <Text selectable style={styles.outputText}>{output}</Text>
        </Card>

        <SectionTitle title="Upload assets" action={`${library.length} saved`} />
        <View style={styles.sourceList}>
          {library.length ? library.map((item) => <LibraryCard key={item.id} item={item} tiers={tiers} />) : <OnboardingCard />}
        </View>

        <SectionTitle title="Retrieved sources" action={`${sources.length} used`} />
        <View style={styles.sourceList}>
          {sources.length ? sources.map((source) => <RetrievedCard key={`${source.id}-${source.excerpt.slice(0, 10)}`} source={source} />) : <EmptySourceCard />}
        </View>

        <LearningDashboards />
        <AutomationAndSearch />
        <PrimaryButton style={styles.resetButton} onPress={clearWorkspace}>Clear Test Workspace</PrimaryButton>
      </ScrollView>
    </Shell>
  );
}


function PremiumPlatformOverview() {
  return (
    <>
      <SectionTitle title="SaaS platform engine" action="Production blueprint" />
      <Card style={styles.platformCard}>
        <Text style={styles.platformTitle}>AI-powered course hosting and intelligent learning engine</Text>
        <Text style={styles.sourceExcerpt}>
          SmartLibrary is being upgraded into a premium SaaS learning platform with course hosting, smart drip, learning paths, audio-to-course generation, AI tutors, certificates, communities, analytics, and webhooks.
        </Text>
        <View style={styles.featureGrid}>
          {platformCapabilities.slice(0, 10).map((capability) => (
            <View key={capability} style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>{capability}</Text>
            </View>
          ))}
        </View>
      </Card>
    </>
  );
}

function RolePermissionMatrix() {
  return (
    <>
      <SectionTitle title="Role permissions" action="RBAC-ready" />
      <View style={styles.sourceList}>
        {roleCards.map((item) => (
          <Card key={item.role} style={styles.roleCard}>
            <Text style={styles.sourceTitle}>{item.role}</Text>
            <Text style={styles.sourceExcerpt}>{item.access}</Text>
          </Card>
        ))}
      </View>
    </>
  );
}

function LearningDashboards() {
  return (
    <>
      <SectionTitle title="Dashboards and analytics" action="Premium UI" />
      <Card style={styles.platformCard}>
        <View style={styles.statRow}>
          <MiniStat label="Completion" value="82%" />
          <MiniStat label="Engagement" value="High" />
          <MiniStat label="Quiz Avg" value="76%" />
        </View>
        <Text style={styles.platformTitle}>Student dashboard</Text>
        <Text style={styles.sourceExcerpt}>Enrolled courses, progress tracking, completed lessons, certificates, learning streak, recommended next lesson, and recent activity.</Text>
        <Text style={styles.platformTitle}>Instructor dashboard</Text>
        <Text style={styles.sourceExcerpt}>Student progress, quiz results, assignment submissions, course analytics, course editing, drip schedules, and announcements.</Text>
        <Text style={styles.platformTitle}>Admin dashboard</Text>
        <Text style={styles.sourceExcerpt}>User management, course approvals, analytics overview, content moderation, audit logs, and platform operations.</Text>
      </Card>
    </>
  );
}

function AutomationAndSearch() {
  return (
    <>
      <SectionTitle title="Automation, tutor and search" action="Webhook-ready" />
      <Card style={styles.platformCard}>
        <Text style={styles.platformTitle}>AI tutor in every lesson</Text>
        <Text style={styles.sourceExcerpt}>Ask AI, suggested questions, lesson explanations, summaries, quiz generation, next lesson recommendations, and answers grounded in transcripts, resources, and instructor notes.</Text>
        <Text style={styles.platformTitle}>Global search</Text>
        <Text style={styles.sourceExcerpt}>Search courses, lessons, transcripts, resources, categories, difficulty levels, instructors, and completion status.</Text>
        <Text style={styles.platformTitle}>Webhook events</Text>
        <View style={styles.typeRow}>
          {automationEvents.map((event) => (
            <View key={event} style={styles.smallChip}>
              <Text style={styles.smallChipText}>{event}</Text>
            </View>
          ))}
        </View>
      </Card>
    </>
  );
}

function GamificationPanel({ libraryCount, tierCount }: { libraryCount: number; tierCount: number }) {
  const xp = libraryCount * 75 + tierCount * 25;
  return (
    <Card style={styles.gameCard}>
      <View style={styles.heroTop}>
        <Pill label="Gamified learning" tone="success" />
        <Text style={styles.heroStat}>{xp} XP ready</Text>
      </View>
      <Text style={styles.gameTitle}>Interactive lessons, badges, checkpoints, and unlocks</Text>
      <View style={styles.statRow}>
        <MiniStat label="Badges" value={libraryCount ? "3" : "0"} />
        <MiniStat label="Streak" value="0d" />
        <MiniStat label="Unlocks" value={String(tierCount)} />
      </View>
      <Text style={styles.sourceExcerpt}>Each structured lesson can include XP rewards, quizzes, assignments, completion gates, badges, and conditional unlock rules.</Text>
    </Card>
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
    <Card>
      <Text style={styles.sourceTitle}>No retrieved source yet</Text>
      <Text style={styles.sourceExcerpt}>SmartLibrary will search the course upload library before generating every course structure.</Text>
    </Card>
  );
}

function OnboardingCard() {
  return (
    <Card>
      <Text style={styles.sourceTitle}>Create a course upload blueprint</Text>
      <Text style={styles.sourceExcerpt}>Choose upload type, tiers, and drip logic. Then generate course modules, lessons, exercises, assignments, quizzes, and gamified checkpoints.</Text>
    </Card>
  );
}

function firstRunOutput() {
  return `Summary:\nSmartLibrary is ready for course creators. Instead of pasting raw text, creators can define uploaded course assets, gate them by custom tiers, apply drip rules, and generate structured learning experiences.\n\nKey Points:\n1. Create unlimited creator-defined tiers such as Free, Premium, VIP, Gold, Cohort, or Inner Circle.\n2. Assign uploaded course assets to tier categories.\n3. Add time-based or conditional drip logic.\n4. Generate modules, lessons, exercises, assignments, quizzes, and interactive checkpoints.\n\nInsights:\nThe product should help creators turn files and videos into guided learning journeys, not static libraries. The highest-value workflow is upload, structure, gate, drip, gamify, and improve completion.\n\nActionable Output:\nStart by selecting an upload asset type, choosing tiers, setting a drip rule, then tapping Create Upload Blueprint.`;
}

function formatNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxl * 2,
  },
  hero: {
    marginBottom: spacing.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  heroStat: {
    color: colors.primary2,
    fontSize: 12,
    fontWeight: "900",
  },
  heroTitle: {
    color: colors.text,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: spacing.md,
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  miniStat: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  miniValue: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
  },
  miniLabel: {
    color: colors.faint,
    fontWeight: "800",
    fontSize: 10,
    marginTop: 4,
    textTransform: "uppercase",
  },
  platformCard: {
    backgroundColor: "#0B1224",
  },
  platformTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: spacing.sm,
  },
  featureGrid: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  featureItem: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  featureBullet: {
    color: colors.primary2,
    fontSize: 16,
    fontWeight: "900",
  },
  featureText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  roleCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  gameCard: {
    marginTop: spacing.md,
    backgroundColor: "#0D1629",
  },
  gameTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  helperText: {
    color: colors.faint,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeChip: {
    borderRadius: 999,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeChipActive: {
    backgroundColor: "rgba(0, 212, 255, 0.13)",
    borderColor: "rgba(0, 212, 255, 0.45)",
  },
  typeChipText: {
    color: colors.muted,
    fontWeight: "800",
    fontSize: 11,
    textTransform: "capitalize",
  },
  typeChipTextActive: {
    color: colors.primary2,
  },
  smallChip: {
    borderRadius: 999,
    backgroundColor: "rgba(109, 94, 248, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallChipText: {
    color: colors.primary2,
    fontSize: 11,
    fontWeight: "900",
  },
  dripCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  dripCardActive: {
    borderColor: colors.primary2,
    backgroundColor: "rgba(0, 212, 255, 0.1)",
  },
  dripText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  dripTextActive: {
    color: colors.text,
  },
  statusCard: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
  },
  statusText: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  actionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  actionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  actionTextActive: {
    color: colors.white,
  },
  outputCard: {
    backgroundColor: "#0B1020",
  },
  outputText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  sourceList: {
    gap: spacing.md,
  },
  retrievedCard: {
    padding: spacing.md,
  },
  sourceTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  sourceMeta: {
    color: colors.primary2,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
    textTransform: "capitalize",
  },
  sourceExcerpt: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  libraryCard: {
    padding: spacing.md,
  },
  libraryTop: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  resetButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

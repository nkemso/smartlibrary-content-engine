import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { DashboardViewProps, DiscoverViewProps, ExperienceViewProps } from "@whop/react-native";
import { Card, Header, Pill, PrimaryButton, SectionTitle, Shell } from "./ui";
import { colors, radius, spacing } from "../lib/design";
import { cacheGet, cacheSet, getHostDetails, setNavigationBar } from "../lib/whop-host";
import {
  buildSuggestedPrompt,
  cleanText,
  countWords,
  createLocalOutput,
  inferTitle,
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

type ProcessingStage = "idle" | "ingesting" | "retrieving" | "thinking" | "ready" | "error";

const API_FALLBACK = "https://smartlibrary-content-engine.vercel.app";

export function SmartLibraryApp(props: SmartLibraryProps) {
  const host = useMemo(() => getHostDetails(), []);
  const userId = props.currentUserId ?? "anonymous";
  const scopeId = props.mode === "experience" ? props.experienceId : props.mode === "dashboard" ? props.companyId : "discover";
  const cacheKey = `smartlibrary:v2:${userId}:${scopeId}`;

  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [rawContent, setRawContent] = useState("");
  const [tiers, setTiers] = useState<ContentTier[]>([
    { id: "tier_free", name: "Free", description: "Public starter content", color: colors.primary2 },
    { id: "tier_premium", name: "Premium", description: "Paid member content", color: colors.primary },
  ]);
  const [newTierName, setNewTierName] = useState("");
  const [selectedTierIds, setSelectedTierIds] = useState<string[]>(["tier_premium"]);
  const [dripType, setDripType] = useState<"instant" | "days_after_join" | "date" | "after_completion">("instant");
  const [dripValue, setDripValue] = useState("");
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<LibraryItem["type"]>("course");
  const [question, setQuestion] = useState("");
  const [activeAction, setActiveAction] = useState<TransformAction>("Summarize");
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [stageText, setStageText] = useState("Upload or paste content to begin.");
  const [output, setOutput] = useState(firstRunOutput());
  const [sources, setSources] = useState<RetrievedSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const apiOrigin = host.apiOrigin || API_FALLBACK;
  const selectedSource = selectedSourceId ? library.find((item) => item.id === selectedSourceId) : library[0];
  const totalWords = library.reduce((sum, item) => sum + item.wordCount, 0);

  useEffect(() => {
    setNavigationBar("SmartLibrary Content Engine", "Upload, retrieve, transform, reuse");
    const cached = cacheGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as LibraryItem[];
        if (Array.isArray(parsed)) {
          setLibrary(parsed);
          if (parsed[0]) {
            setSelectedSourceId(parsed[0].id);
            const prompt = buildSuggestedPrompt(parsed[0]);
            setQuestion(prompt);
            const retrieved = retrieveRelevantSources(parsed, prompt, 4);
            setSources(retrieved);
            setOutput(createLocalOutput("Summarize", prompt, retrieved, parsed));
            setStageText("Your saved content is ready. Ask a question or choose an action.");
          }
        }
      } catch {
        setStageText("Your workspace is ready. Add content to begin.");
      }
    }
  }, [cacheKey]);

  useEffect(() => {
    cacheSet(cacheKey, JSON.stringify(library));
  }, [cacheKey, library]);

  async function ingestContent() {
    const input = rawContent.trim();
    if (!input) {
      setStage("error");
      setStageText("Add a course, file, video, audio, or link URL first. For local files, upload them to your storage/Whop/Vimeo/Drive first, then paste the share URL.");
      return;
    }

    setStage("ingesting");
    setStageText("Reading your content...");

    let finalText = input;
    let finalTitle = title.trim();
    let source = input;
    let finalType = contentType;
    const assignedTiers = tiers.filter((tier) => selectedTierIds.includes(tier.id)).map((tier) => tier.name).join(", ") || "Ungated";
    const dripDescription = describeDrip(dripType, dripValue);

    if (/^https?:\/\//i.test(input)) {
      try {
        setStageText("Fetching link and extracting readable text...");
        const response = await fetch(`${apiOrigin}/api/ingest`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: input }),
        });
        if (response.ok) {
          const data = (await response.json()) as { title?: string; text?: string };
          finalTitle = finalTitle || data.title || input;
          finalText = data.text || input;
        }
      } catch {
        finalText = input;
      }
    }

    finalText = cleanText(`Upload Type: ${finalType}. Title: ${finalTitle || inferTitle(input, "Uploaded Course Asset")}. Source URL: ${input}. Assigned Tiers: ${assignedTiers}. Drip Rule: ${dripDescription}. Extracted Content: ${finalText}`);
    if (finalText.length < 20) {
      setStage("error");
      setStageText("The upload could not be read. Add a valid course, file, video, audio, or link URL.");
      return;
    }

    const item: LibraryItem = {
      id: makeId("src"),
      title: finalTitle || inferTitle(finalText, finalType === "link" ? "Imported Link" : "Uploaded Content"),
      type: finalType,
      content: finalText,
      source,
      uploadUrl: input,
      tierIds: selectedTierIds,
      dripRule: { type: dripType, value: dripValue || undefined, description: dripDescription },
      interactive: true,
      createdAt: new Date().toISOString(),
      wordCount: countWords(finalText),
    };

    const nextLibrary = [item, ...library].slice(0, 60);
    setLibrary(nextLibrary);
    setSelectedSourceId(item.id);
    setRawContent("");
    setTitle("");

    const prompt = buildSuggestedPrompt(item);
    setQuestion(prompt);
    setStage("retrieving");
    setStageText("Searching your library first...");

    const retrieved = retrieveRelevantSources(nextLibrary, prompt, 4);
    setSources(retrieved);
    const immediate = createLocalOutput("Summarize", prompt, retrieved, nextLibrary);
    setOutput(immediate);

    setStage("thinking");
    setStageText("Generating your first useful result...");
    await transform("Summarize", prompt, nextLibrary, retrieved, immediate);
  }

  async function transform(action = activeAction, customQuestion = question, currentLibrary = library, currentSources?: RetrievedSource[], fallback?: string) {
    const prompt = customQuestion.trim() || action;
    setActiveAction(action);
    setStage("retrieving");
    setStageText("Searching your knowledge base before answering...");

    const retrieved = currentSources || retrieveRelevantSources(currentLibrary, prompt, 5);
    setSources(retrieved);

    const localOutput = fallback || createLocalOutput(action, prompt, retrieved, currentLibrary);
    setOutput(localOutput);

    if (currentLibrary.length === 0) {
      setStage("ready");
      setStageText("Add content to unlock grounded answers.");
      return;
    }

    setStage("thinking");
    setStageText("Transforming retrieved content into finished work...");

    try {
      const response = await fetch(`${apiOrigin}/api/transform`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          question: prompt,
          sources: retrieved,
          libraryMeta: currentLibrary.map((item) => ({ id: item.id, title: item.title, type: item.type, wordCount: item.wordCount })),
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { output?: string };
        if (data.output && data.output.trim()) {
          setOutput(data.output.trim());
        }
      }
      setStage("ready");
      setStageText("Your output is ready. Copy, share, refine, or choose another action.");
    } catch {
      setStage("ready");
      setStageText("Generated locally. Connect the API key for deeper AI rewriting.");
    }
  }

  async function shareOutput() {
    setStageText("Select the output text to copy it cleanly, then share it anywhere.");
  }

  function removeSource(id: string) {
    const next = library.filter((item) => item.id !== id);
    setLibrary(next);
    setSelectedSourceId(next[0]?.id ?? null);
    const prompt = question || "Summarize my library";
    const retrieved = retrieveRelevantSources(next, prompt, 4);
    setSources(retrieved);
    setOutput(createLocalOutput(activeAction, prompt, retrieved, next));
  }

  const isBusy = stage === "ingesting" || stage === "retrieving" || stage === "thinking";

  return (
    <Shell>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Header title="SmartLibrary" subtitle="AI knowledge engine for your Whop community" badge={props.mode === "dashboard" ? "Admin" : "Native"} />

          <Card style={styles.hero}>
            <View style={styles.heroTop}>
              <Pill label={library.length ? "Knowledge base active" : "60-second first value"} tone={library.length ? "success" : "warning"} />
              <Text style={styles.heroStat}>{library.length} sources</Text>
            </View>
            <Text style={styles.heroTitle}>{library.length ? "Ask, transform, and reuse your content" : "Upload your first knowledge source"}</Text>
            <Text style={styles.heroText}>
              SmartLibrary turns uploaded courses, files, videos, audio, and links into gated modules, lessons, exercises, assignments, quizzes, drip schedules, and interactive learning paths.
            </Text>
            <View style={styles.statRow}>
              <MiniStat label="Words" value={formatNumber(totalWords)} />
              <MiniStat label="Retrieved" value={String(sources.length)} />
              <MiniStat label="Mode" value={props.mode} />
            </View>
          </Card>

          <GamificationPanel libraryCount={library.length} tierCount={tiers.length} />

          <SectionTitle title="1. Upload course asset" action="Course, file, video, audio, link" />
          <Card>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Course/file/video title"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />
            <View style={styles.typeRow}>
              {(["course", "file", "video", "audio", "link", "manual", "transcript"] as LibraryItem["type"][]).map((type) => (
                <Pressable key={type} onPress={() => setContentType(type)} style={[styles.typeChip, contentType === type && styles.typeChipActive]}>
                  <Text style={[styles.typeChipText, contentType === type && styles.typeChipTextActive]}>{type}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={rawContent}
              onChangeText={setRawContent}
              placeholder="Upload URL: course file, PDF, video, audio, Drive link, Vimeo/YouTube link, Whop content link, transcript URL, or hosted file URL"
              placeholderTextColor={colors.faint}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.contentInput]}
            />
            <TierManager tiers={tiers} selectedTierIds={selectedTierIds} newTierName={newTierName} setNewTierName={setNewTierName} setSelectedTierIds={setSelectedTierIds} setTiers={setTiers} />
            <DripManager dripType={dripType} setDripType={setDripType} dripValue={dripValue} setDripValue={setDripValue} />
            <PrimaryButton onPress={ingestContent} disabled={isBusy}>
              {isBusy ? "Processing upload..." : "Upload and Structure"}
            </PrimaryButton>
          </Card>

          <StatusCard stage={stage} text={stageText} busy={isBusy} />

          <SectionTitle title="2. Choose an action" action="RAG first" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
            {transformActions.map((action, index) => (
              <Pressable key={`${action}-${index}`} onPress={() => transform(action)} style={[styles.actionChip, activeAction === action && styles.actionChipActive]}>
                <Text style={[styles.actionText, activeAction === action && styles.actionTextActive]}>{action}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Card>
            <Text style={styles.label}>Ask a grounded question or describe the output you want</Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Example: Create a 30-minute lesson plan from my latest upload"
              placeholderTextColor={colors.faint}
              multiline
              style={[styles.input, styles.questionInput]}
            />
            <PrimaryButton onPress={() => transform(activeAction)} disabled={isBusy}>
              Generate Grounded Output
            </PrimaryButton>
          </Card>

          <SectionTitle title="3. Finished output" action="Selectable" />
          <Card style={styles.outputCard}>
            {isBusy ? <ActivityIndicator color={colors.primary2} style={{ marginBottom: spacing.md }} /> : null}
            <Text selectable style={styles.outputText}>{output}</Text>
            <PrimaryButton style={styles.shareButton} onPress={shareOutput}>
              Share Output
            </PrimaryButton>
          </Card>

          <SectionTitle title="Retrieved sources" action={sources.length ? `${sources.length} used` : "None yet"} />
          <View style={styles.sourceList}>
            {sources.length ? sources.map((source) => <RetrievedCard key={`${source.id}-${source.excerpt.slice(0, 12)}`} source={source} />) : <EmptySourceCard />}
          </View>

          <SectionTitle title="Library" action={`${library.length} saved`} />
          <View style={styles.sourceList}>
            {library.length ? library.map((item) => (
              <LibraryCard
                key={item.id}
                item={item}
                selected={selectedSource?.id === item.id}
                onSelect={() => {
                  setSelectedSourceId(item.id);
                  const prompt = buildSuggestedPrompt(item);
                  setQuestion(prompt);
                  transform("Summarize", prompt, library, retrieveRelevantSources([item], prompt, 3));
                }}
                onRemove={() => removeSource(item.id)}
              />
            )) : <OnboardingCard />}
          </View>
      </ScrollView>
    </Shell>
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
        <MiniStat label="Tiers" value={String(tierCount)} />
      </View>
      <Text style={styles.sourceExcerpt}>Each structured lesson can include XP rewards, quizzes, assignments, completion gates, badges, and conditional unlock rules.</Text>
    </Card>
  );
}

function TierManager({
  tiers,
  selectedTierIds,
  newTierName,
  setNewTierName,
  setSelectedTierIds,
  setTiers,
}: {
  tiers: ContentTier[];
  selectedTierIds: string[];
  newTierName: string;
  setNewTierName: (value: string) => void;
  setSelectedTierIds: (value: string[]) => void;
  setTiers: (value: ContentTier[]) => void;
}) {
  function toggleTier(id: string) {
    setSelectedTierIds(selectedTierIds.includes(id) ? selectedTierIds.filter((tierId) => tierId !== id) : [...selectedTierIds, id]);
  }

  function addTier() {
    const name = newTierName.trim();
    if (!name) return;
    const tier: ContentTier = {
      id: makeId("tier"),
      name,
      description: `${name} gated content`,
      color: colors.primary2,
    };
    setTiers([...tiers, tier]);
    setSelectedTierIds([...selectedTierIds, tier.id]);
    setNewTierName("");
  }

  return (
    <View style={styles.managerBox}>
      <Text style={styles.label}>Gate content by unlimited creator-defined tiers</Text>
      <View style={styles.typeRow}>
        {tiers.map((tier) => (
          <Pressable key={tier.id} onPress={() => toggleTier(tier.id)} style={[styles.typeChip, selectedTierIds.includes(tier.id) && styles.typeChipActive]}>
            <Text style={[styles.typeChipText, selectedTierIds.includes(tier.id) && styles.typeChipTextActive]}>{tier.name}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.inlineRow}>
        <TextInput value={newTierName} onChangeText={setNewTierName} placeholder="Create tier e.g. Gold, VIP, Cohort 1" placeholderTextColor={colors.faint} style={[styles.input, styles.inlineInput]} />
        <Pressable onPress={addTier} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DripManager({
  dripType,
  setDripType,
  dripValue,
  setDripValue,
}: {
  dripType: "instant" | "days_after_join" | "date" | "after_completion";
  setDripType: (value: "instant" | "days_after_join" | "date" | "after_completion") => void;
  dripValue: string;
  setDripValue: (value: string) => void;
}) {
  const options: Array<typeof dripType> = ["instant", "days_after_join", "date", "after_completion"];
  return (
    <View style={styles.managerBox}>
      <Text style={styles.label}>Drip logic</Text>
      <View style={styles.typeRow}>
        {options.map((option) => (
          <Pressable key={option} onPress={() => setDripType(option)} style={[styles.typeChip, dripType === option && styles.typeChipActive]}>
            <Text style={[styles.typeChipText, dripType === option && styles.typeChipTextActive]}>{option.replace(/_/g, " ")}</Text>
          </Pressable>
        ))}
      </View>
      {dripType !== "instant" ? (
        <TextInput value={dripValue} onChangeText={setDripValue} placeholder="Days, unlock date, or prerequisite lesson" placeholderTextColor={colors.faint} style={styles.input} />
      ) : null}
    </View>
  );
}

function describeDrip(type: "instant" | "days_after_join" | "date" | "after_completion", value: string) {
  if (type === "instant") return "Available immediately";
  if (type === "days_after_join") return `Unlocks ${value || "X"} days after joining`;
  if (type === "date") return `Unlocks on ${value || "selected date"}`;
  return `Unlocks after completing ${value || "required prior content"}`;
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

function LibraryCard({ item, selected, onSelect, onRemove }: { item: LibraryItem; selected: boolean; onSelect: () => void; onRemove: () => void }) {
  return (
    <Pressable onPress={onSelect}>
      <Card style={[styles.libraryCard, selected && styles.libraryCardActive]}>
        <View style={styles.libraryTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sourceTitle}>{item.title}</Text>
            <Text style={styles.sourceMeta}>{item.type} • {formatNumber(item.wordCount)} words</Text>
          </View>
          <Pressable onPress={onRemove} style={styles.removeButton}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
        <Text style={styles.sourceExcerpt}>{item.content.slice(0, 210)}{item.content.length > 210 ? "..." : ""}</Text>
      </Card>
    </Pressable>
  );
}

function EmptySourceCard() {
  return (
    <Card>
      <Text style={styles.sourceTitle}>No retrieved source yet</Text>
      <Text style={styles.sourceExcerpt}>SmartLibrary will search your uploaded knowledge base before generating every answer.</Text>
    </Card>
  );
}

function OnboardingCard() {
  return (
    <Card>
      <Text style={styles.sourceTitle}>Your content is the engine</Text>
      <Text style={styles.sourceExcerpt}>Start by uploading a course, file, video, audio, transcript, manual, or link URL. SmartLibrary will immediately produce a grounded, reusable result.</Text>
    </Card>
  );
}

function firstRunOutput() {
  return `Summary:\nWelcome to SmartLibrary Content Engine. Upload your first content source to turn raw knowledge into finished, reusable intelligence.\n\nKey Points:\n1. Paste text, notes, transcripts, manuals, course material, research, or a link.\n2. SmartLibrary will process the content and search it before answering.\n3. You can generate summaries, lessons, outlines, action plans, SOPs, posts, reports, and recommendations.\n\nInsights:\nThe most useful first step is to upload one strong source. Within the first minute, you should have a clear summary and a practical next action.\n\nActionable Output:\nAdd your first course/file/video URL above, assign it to one or more tiers, choose a drip rule, then tap Upload and Structure.`;
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
  managerBox: {
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  inlineRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  inlineInput: {
    flex: 1,
    marginBottom: 0,
  },
  smallButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  smallButtonText: {
    color: colors.white,
    fontWeight: "900",
  },
  input: {
    backgroundColor: colors.surface2,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  contentInput: {
    minHeight: 150,
    lineHeight: 20,
  },
  questionInput: {
    minHeight: 82,
    lineHeight: 20,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.7,
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
    paddingBottom: spacing.md,
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
  shareButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.border,
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
  libraryCardActive: {
    borderColor: colors.primary2,
    backgroundColor: "#111A31",
  },
  libraryTop: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  removeButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255, 107, 136, 0.12)",
  },
  removeText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "900",
  },
});

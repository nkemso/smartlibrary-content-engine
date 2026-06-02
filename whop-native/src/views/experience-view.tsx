import React, { useEffect, useMemo } from "react";
import type { ExperienceViewProps } from "@whop/react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  ActivityItem,
  Card,
  Header,
  Metric,
  Pill,
  PrimaryButton,
  SectionTitle,
  Shell,
} from "../components/ui";
import { colors, radius, spacing } from "../lib/design";
import { getHostDetails, navigate, setNavigationBar } from "../lib/whop-host";

export function ExperienceView(props: ExperienceViewProps) {
  const host = useMemo(() => getHostDetails(), []);

  useEffect(() => {
    setNavigationBar("SmartLibrary Content Engine", "AI-powered library workspace");
  }, []);

  return (
    <Shell>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header title="SmartLibrary" subtitle="Content Engine for your Whop community" badge="Native" />

        <Card style={styles.hero}>
          <Pill label="Whop experience connected" tone="success" />
          <Text style={styles.heroTitle}>Welcome back, Curator</Text>
          <Text style={styles.heroText}>
            Ingest member resources, summarize documents, and organize premium knowledge in one mobile-safe Whop app.
          </Text>
          <View style={styles.buttonRow}>
            <PrimaryButton style={{ flex: 1 }} onPress={() => navigate(["library"])}>Open Library</PrimaryButton>
            <PrimaryButton style={[styles.secondaryButton, { flex: 1 }]} onPress={() => navigate(["ingest"])}>Add Source</PrimaryButton>
          </View>
        </Card>

        <SectionTitle title="Workspace snapshot" action="Live" />
        <View style={styles.grid}>
          <Metric label="Documents" value="1,432" detail="Imported resources" tone="primary" />
          <Metric label="Active threads" value="84" detail="Member questions" tone="success" />
          <Metric label="AI capacity" value="45GB" detail="Used of 100GB" tone="warning" />
          <Metric label="Access" value="OK" detail="Whop user verified" tone="success" />
        </View>

        <SectionTitle title="Recent engine activity" action="View all" />
        <Card>
          <ActivityItem icon="🧠" title="AI processed document" detail="Q3_Financial_Analysis_Draft.pdf" time="2m" />
          <ActivityItem icon="🔗" title="New link added" detail="Source: Whop API Documentation" time="1h" />
          <ActivityItem icon="👤" title="Workspace invite accepted" detail="Sarah J. joined Research Alpha" time="3h" />
          <ActivityItem icon="✅" title="Access check passed" detail={`Experience ${props.experienceId}`} time="now" />
        </Card>

        <SectionTitle title="Whop runtime" />
        <Card style={styles.runtimeCard}>
          <RuntimeLine label="experienceId" value={props.experienceId} />
          <RuntimeLine label="companyId" value={props.companyId} />
          <RuntimeLine label="currentUserId" value={props.currentUserId ?? "not supplied"} />
          <RuntimeLine label="route" value={`/${props.path.join("/")}`} />
          <RuntimeLine label="platform" value={host.platform} />
          <RuntimeLine label="apiOrigin" value={host.apiOrigin ?? "not available outside Whop host"} />
        </Card>
      </ScrollView>
    </Shell>
  );
}

function RuntimeLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.runtimeLine}>
      <Text style={styles.runtimeLabel}>{label}</Text>
      <Text style={styles.runtimeValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxl,
  },
  hero: {
    overflow: "hidden",
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: spacing.lg,
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  secondaryButton: {
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  runtimeCard: {
    borderRadius: radius.md,
  },
  runtimeLine: {
    gap: 4,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  runtimeLabel: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  runtimeValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
});

import React, { useEffect, useMemo } from "react";
import type { DashboardViewProps } from "@whop/react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, Header, Metric, Pill, PrimaryButton, SectionTitle, Shell } from "../components/ui";
import { colors, spacing } from "../lib/design";
import { getHostDetails, navigate, setNavigationBar } from "../lib/whop-host";

export function DashboardView(props: DashboardViewProps) {
  const host = useMemo(() => getHostDetails(), []);

  useEffect(() => {
    setNavigationBar("SmartLibrary Admin", "Manage library ingestion and access");
  }, []);

  return (
    <Shell>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header title="Admin Console" subtitle="SmartLibrary Content Engine" badge="Dashboard" />

        <Card>
          <Pill label="Creator dashboard" />
          <Text style={styles.title}>Golden Vision library operations</Text>
          <Text style={styles.body}>
            Configure ingestion queues, review AI processing jobs, and monitor member access from inside the Whop dashboard.
          </Text>
          <PrimaryButton style={{ marginTop: spacing.lg }} onPress={() => navigate(["settings"])}>
            Configure Engine
          </PrimaryButton>
        </Card>

        <SectionTitle title="Admin metrics" action="Last 24h" />
        <View style={styles.grid}>
          <Metric label="Queued items" value="27" detail="Waiting for processing" tone="warning" />
          <Metric label="Processed" value="312" detail="Summaries generated" tone="success" />
          <Metric label="Members" value="1.2K" detail="With valid access" tone="primary" />
          <Metric label="Errors" value="0" detail="No failing jobs" tone="success" />
        </View>

        <SectionTitle title="Deployment health" />
        <Card>
          <HealthLine label="companyId" value={props.companyId} />
          <HealthLine label="currentUserId" value={props.currentUserId ?? "not supplied"} />
          <HealthLine label="route" value={`/${props.path.join("/")}`} />
          <HealthLine label="hostPlatform" value={host.platform} />
          <HealthLine label="apiOrigin" value={host.apiOrigin ?? "configure Base URL in Whop"} />
        </Card>
      </ScrollView>
    </Shell>
  );
}

function HealthLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.healthLine}>
      <Text style={styles.healthLabel}>{label}</Text>
      <Text style={styles.healthValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: spacing.md,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  healthLine: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  healthLabel: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  healthValue: {
    color: colors.text,
    fontSize: 13,
    marginTop: 3,
    fontWeight: "700",
  },
});

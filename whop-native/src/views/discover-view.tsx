import React, { useEffect } from "react";
import type { DiscoverViewProps } from "@whop/react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, Header, Pill, PrimaryButton, SectionTitle, Shell } from "../components/ui";
import { colors, spacing } from "../lib/design";
import { navigate, setNavigationBar } from "../lib/whop-host";

export function DiscoverView(props: DiscoverViewProps) {
  useEffect(() => {
    setNavigationBar("SmartLibrary", "Discover AI knowledge workspaces");
  }, []);

  return (
    <Shell>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header title="SmartLibrary" subtitle="AI content engine for Whop" badge="Discover" />

        <Card>
          <Pill label="Marketplace-ready" tone="success" />
          <Text style={styles.title}>Turn community content into a searchable AI library.</Text>
          <Text style={styles.body}>
            SmartLibrary helps creators organize documents, links, course material, and community knowledge into a premium mobile experience.
          </Text>
          <PrimaryButton style={{ marginTop: spacing.lg }} onPress={() => navigate(["learn-more"])}>
            Learn More
          </PrimaryButton>
        </Card>

        <SectionTitle title="What members get" />
        <View style={styles.featureGrid}>
          <Feature title="AI summaries" detail="Generate quick takeaways from uploaded content." />
          <Feature title="Source library" detail="Keep videos, links, docs, and notes searchable." />
          <Feature title="Whop access" detail="Use Whop experience membership as the gate." />
          <Feature title="Mobile-native" detail="Runs inside the Whop iOS/Android app." />
        </View>

        <SectionTitle title="Debug context" />
        <Card>
          <Text style={styles.debugText}>currentUserId: {props.currentUserId ?? "not supplied"}</Text>
          <Text style={styles.debugText}>path: /{props.path.join("/")}</Text>
        </Card>
      </ScrollView>
    </Shell>
  );
}

function Feature({ title, detail }: { title: string; detail: string }) {
  return (
    <Card style={styles.feature}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDetail}>{detail}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: spacing.md,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  featureGrid: {
    gap: spacing.md,
  },
  feature: {
    padding: spacing.lg,
  },
  featureTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  featureDetail: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  debugText: {
    color: colors.muted,
    fontSize: 12,
    marginVertical: 3,
  },
});

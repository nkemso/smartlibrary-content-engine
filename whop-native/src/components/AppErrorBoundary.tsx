import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../lib/design";

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.logo}>SL</Text>
          <Text style={styles.title}>SmartLibrary recovered safely</Text>
          <Text style={styles.body}>
            The advanced upload workspace hit a runtime issue on this device. This safe mode keeps the app open while the upload module is patched.
          </Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Creator workflow</Text>
            <Text style={styles.item}>1. Upload courses, files, videos, audio, transcripts, and links.</Text>
            <Text style={styles.item}>2. Structure them into modules, lessons, quizzes, assignments, and exercises.</Text>
            <Text style={styles.item}>3. Gate content by custom tiers.</Text>
            <Text style={styles.item}>4. Add drip logic and gamified completion checkpoints.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Runtime note</Text>
            <Text selectable style={styles.item}>{this.state.message || "Unknown runtime error"}</Text>
          </View>
          <Pressable style={styles.button} onPress={() => this.setState({ hasError: false, message: "" })}>
            <Text style={styles.buttonText}>Try Reloading Workspace</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

export function withAppErrorBoundary(node: React.ReactNode) {
  return <AppErrorBoundary>{node}</AppErrorBoundary>;
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  logo: {
    color: colors.primary2,
    fontSize: 28,
    fontWeight: "900",
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  item: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonText: {
    color: colors.white,
    fontWeight: "900",
  },
});

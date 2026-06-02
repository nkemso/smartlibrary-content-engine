import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Haptics } from "@whop/react-native";
import { colors, radius, spacing } from "../lib/design";

export function Shell({ children }: { children: React.ReactNode }) {
  return <View style={styles.shell}>{children}</View>;
}

export function Header({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>SL</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionText}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

export function Metric({
  label,
  value,
  detail,
  tone = "primary",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const toneColor = {
    primary: colors.primary2,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  }[tone];

  return (
    <Card style={styles.metric}>
      <View style={[styles.metricDot, { backgroundColor: toneColor }]} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </Card>
  );
}

export function ActivityItem({
  icon,
  title,
  detail,
  time,
}: {
  icon: string;
  title: string;
  detail: string;
  time: string;
}) {
  return (
    <View style={styles.activity}>
      <View style={styles.activityIcon}>
        <Text style={styles.activityIconText}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityDetail}>{detail}</Text>
      </View>
      <Text style={styles.activityTime}>{time}</Text>
    </View>
  );
}

export function PrimaryButton({
  children,
  style,
  onPress,
  ...props
}: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  async function handlePress(event: Parameters<NonNullable<PressableProps["onPress"]>>[0]) {
    await Haptics.trigger("impactLight").catch(() => undefined);
    onPress?.(event);
  }

  return (
    <Pressable {...props} onPress={handlePress} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, style]}>
      <Text style={styles.buttonText}>{children}</Text>
    </Pressable>
  );
}

export function Pill({ label, tone = "default" }: { label: string; tone?: "default" | "success" | "warning" }) {
  const backgroundColor = tone === "success" ? "rgba(39, 215, 153, 0.14)" : tone === "warning" ? "rgba(246, 200, 76, 0.14)" : "rgba(109, 94, 248, 0.16)";
  const color = tone === "success" ? colors.success : tone === "warning" ? colors.warning : colors.primary2;
  return (
    <View style={[styles.pill, { backgroundColor }]}> 
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoText: {
    color: colors.primary2,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(39, 215, 153, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(39, 215, 153, 0.35)",
  },
  badgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  sectionTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionAction: {
    color: colors.primary2,
    fontSize: 12,
    fontWeight: "800",
  },
  metric: {
    flex: 1,
    minWidth: 148,
  },
  metricDot: {
    width: 9,
    height: 9,
    borderRadius: 9,
    marginBottom: spacing.md,
  },
  metricValue: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "900",
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    fontWeight: "700",
  },
  metricDetail: {
    color: colors.faint,
    fontSize: 11,
    marginTop: 7,
  },
  activity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  activityIconText: {
    fontSize: 17,
  },
  activityTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  activityDetail: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  activityTime: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "700",
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 14,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
  },
});

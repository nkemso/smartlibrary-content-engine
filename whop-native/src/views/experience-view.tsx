import React from "react";
import type { ExperienceViewProps } from "@whop/react-native";
import { SmartLibraryApp } from "../components/SmartLibraryApp";
import { withAppErrorBoundary } from "../components/AppErrorBoundary";

export function ExperienceView(props: ExperienceViewProps) {
  return withAppErrorBoundary(<SmartLibraryApp mode="experience" {...props} />);
}

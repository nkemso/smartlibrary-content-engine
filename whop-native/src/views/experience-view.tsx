import React from "react";
import type { ExperienceViewProps } from "@whop/react-native";
import { SmartLibraryApp } from "../components/SmartLibraryApp";

export function ExperienceView(props: ExperienceViewProps) {
  return <SmartLibraryApp mode="experience" {...props} />;
}

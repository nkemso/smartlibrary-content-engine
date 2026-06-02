import React from "react";
import type { DashboardViewProps } from "@whop/react-native";
import { SmartLibraryApp } from "../components/SmartLibraryApp";

export function DashboardView(props: DashboardViewProps) {
  return <SmartLibraryApp mode="dashboard" {...props} />;
}

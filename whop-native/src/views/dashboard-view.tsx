import React from "react";
import type { DashboardViewProps } from "@whop/react-native";
import { SmartLibraryApp } from "../components/SmartLibraryApp";
import { withAppErrorBoundary } from "../components/AppErrorBoundary";

export function DashboardView(props: DashboardViewProps) {
  return withAppErrorBoundary(<SmartLibraryApp mode="dashboard" {...props} />);
}

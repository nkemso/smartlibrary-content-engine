import React from "react";
import type { DiscoverViewProps } from "@whop/react-native";
import { SmartLibraryApp } from "../components/SmartLibraryApp";
import { withAppErrorBoundary } from "../components/AppErrorBoundary";

export function DiscoverView(props: DiscoverViewProps) {
  return withAppErrorBoundary(<SmartLibraryApp mode="discover" {...props} />);
}

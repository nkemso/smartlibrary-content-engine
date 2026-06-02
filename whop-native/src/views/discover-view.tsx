import React from "react";
import type { DiscoverViewProps } from "@whop/react-native";
import { SmartLibraryApp } from "../components/SmartLibraryApp";

export function DiscoverView(props: DiscoverViewProps) {
  return <SmartLibraryApp mode="discover" {...props} />;
}

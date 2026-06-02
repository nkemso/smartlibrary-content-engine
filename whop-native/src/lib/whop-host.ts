import { __internal_execSync } from "@whop/react-native";

export type HostDetails = {
  apiOrigin: string | null;
  platform: "ios" | "android" | "web" | "unknown";
  version: string | null;
  build: string | null;
  buildType: "appstore" | "testflight" | "debug" | "unknown";
};

export function getHostDetails(): HostDetails {
  const fallback: HostDetails = {
    apiOrigin: null,
    platform: "unknown",
    version: null,
    build: null,
    buildType: "unknown",
  };

  try {
    const { apiOrigin } = __internal_execSync("getAppApiOrigin", {});
    const host = __internal_execSync("getHostAppDetails", {});

    return {
      apiOrigin,
      platform: host.platform,
      version: host.version,
      build: host.build,
      buildType: host.buildType,
    };
  } catch {
    // Allows the views to render safely in local/web preview environments that
    // do not expose Whop's native bridge.
    return fallback;
  }
}

export function setNavigationBar(title: string, description?: string) {
  try {
    __internal_execSync("setNavigationBarData", {
      title,
      description: description ?? null,
    });
  } catch {
    // no-op outside Whop host
  }
}

export function navigate(path: string[], params: Record<string, string> = {}) {
  try {
    __internal_execSync("routerPush", { path, params });
  } catch {
    // no-op outside Whop host
  }
}

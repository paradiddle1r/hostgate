import type { CapacitorConfig } from "@capacitor/cli";

// HostGate Owner — remote-URL shell over the live PMS. Every web deploy
// updates the app instantly; the native layer adds push + session persistence.
// webDir points at a stub folder (required by the CLI even in remote mode).
const config: CapacitorConfig = {
  appId: "app.hostgate.owner",
  appName: "HostGate",
  webDir: "www",
  server: {
    url: "https://hostgate.app/app",
    // Android WebView must present https for Supabase cookies/CORS to behave.
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0a0e14",
      showSpinner: false,
    },
  },
  ios: {
    contentInset: "always",
  },
};

export default config;

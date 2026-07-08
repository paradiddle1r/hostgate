import type { CapacitorConfig } from "@capacitor/cli";

// HostGate Tenant — remote-URL shell over the tenant portal (/tenant, built by
// loop task 04). Camera permission is used for payment-slip capture; add the
// usage strings when the iOS platform is generated:
//   ios/App/App/Info.plist → NSCameraUsageDescription / NSPhotoLibraryUsageDescription
const config: CapacitorConfig = {
  appId: "app.hostgate.tenant",
  appName: "HostGate Tenant",
  webDir: "www",
  server: {
    url: "https://hostgate.app/tenant",
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#eef1fb",
      showSpinner: false,
    },
  },
  ios: {
    contentInset: "always",
  },
};

export default config;

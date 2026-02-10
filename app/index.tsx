import { Colors } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { Dimensions, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = (width - 48) / 2;

export default function HomeScreen() {
  const router = useRouter();

  const menuItems = [
    { title: "Kontak", icon: "account-group", route: "/contact", color: "#E3F2FD", iconColor: "#1976D2" },
    { title: "Transaksi", icon: "cash-register", route: "/invoice", color: "#E8F5E9", iconColor: "#388E3C" },
    { title: "Laporan", icon: "file-chart", route: null, color: "#FFF3E0", iconColor: "#F57C00" },
    { title: "Pengaturan", icon: "cog", route: "/settings", color: "#F3E5F5", iconColor: "#7B1FA2" },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerBackground}>
        <View style={styles.headerSection}>
          <View style={styles.logoCircle}>
            <MaterialCommunityIcons name="tree" size={44} color="white" />
          </View>
          <Text style={styles.title}>Kayu Ping</Text>
          <Text style={styles.subtitle}>Pencatatan Bisnis Kayu</Text>
        </View>
      </View>

      <View style={styles.contentSection}>
        <View style={styles.gridContainer}>
          {menuItems.map((item, index) => (
            <Pressable
              key={index}
              style={({ pressed }) => [
                styles.gridButton,
                { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
              onPress={() => (item.route ? router.push(item.route as any) : {})}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
                <MaterialCommunityIcons name={item.icon as any} size={32} color={item.iconColor} />
              </View>
              <Text style={styles.buttonText}>{item.title}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#CCC" style={styles.arrowIcon} />
            </Pressable>
          ))}
        </View>
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Ver: v{Constants.expoConfig?.version || "N/A"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  headerBackground: {
    backgroundColor: Colors.primary,
    paddingTop: 80,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  headerSection: {
    alignItems: "center",
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "white",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    fontWeight: "500",
  },
  contentSection: {
    paddingHorizontal: 16,
    marginTop: -20,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridButton: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH + 10,
    borderRadius: 20,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "#FFF",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  arrowIcon: {
    position: "absolute",
    bottom: 12,
    right: 12,
  },
  versionContainer: {
    alignItems: "center",
    paddingBottom: 20,
    marginTop: 16,
  },
  versionText: {
    fontSize: 14,
    color: "#838383",
    fontWeight: "400",
  },
});

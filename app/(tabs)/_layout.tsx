import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/tabs";

export default function TransactionTabs() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarLabelStyle: { fontSize: 12 },
        tabBarStyle: { paddingBottom: 8 },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="invoice"
        options={{
          title: "Nota",
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="payment"
        options={{
          title: "Pembayaran",
          tabBarIcon: ({ color, size }) => <Ionicons name="card" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

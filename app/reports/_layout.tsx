import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/tabs";

export default function ReportLayout() {
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
        name="debt"
        options={{
          title: "Hutang",
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

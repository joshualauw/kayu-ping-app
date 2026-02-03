import { Colors, Spacing } from "@/constants/theme";
import { StyleSheet, View, ViewProps } from "react-native";

export function Container({ children, style, ...props }: ViewProps) {
  return (
    <View style={[styles.container, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.md,
  },
});

import { Colors, Spacing } from "@/constants/theme";
import React, { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface DeleteModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  children?: ReactNode;
}

const DeleteModal = ({ visible, onConfirm, onCancel, title, message, children }: DeleteModalProps) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.overlay}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {children}
        <View style={styles.buttons}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Batal</Text>
          </Pressable>
          <Pressable style={styles.deleteBtn} onPress={onConfirm}>
            <Text style={styles.deleteText}>Hapus</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#6B7280",
    lineHeight: 24,
    textAlign: "center",
  },
  buttons: {
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "center",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    alignItems: "center",
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: Colors.danger,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  deleteText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});

export default DeleteModal;

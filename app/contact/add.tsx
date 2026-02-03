import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts } from "@/db/schema";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Contacts from "expo-contacts";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import * as yup from "yup";

const schema = yup
  .object({
    name: yup.string().required("Nama wajib diisi"),
    phone: yup
      .string()
      .required("Nomor telepon wajib diisi")
      .matches(/^\+?\d{6,15}$/, "Nomor telepon tidak valid"),
    category: yup
      .string()
      .oneOf(["supplier", "langganan", "supir", "lainnya"], "Kategori tidak valid")
      .required("Kategori wajib dipilih"),
    note: yup.string().optional(),
  })
  .required();

type FormValues = yup.InferType<typeof schema>;

export default function AddContactScreen() {
  const router = useRouter();

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { name: "", phone: "", category: "langganan", note: "" },
  });

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<Contacts.Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const loadPhoneContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === "granted") {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });
      setPhoneContacts(data);
    }
  };

  const selectContact = (contact: Contacts.Contact) => {
    const name = contact.name;
    const phone = contact.phoneNumbers?.[0]?.number || "";
    const cleanPhone = phone.replace(/[^0-9+]/g, "");

    setValue("name", name);
    setValue("phone", cleanPhone);
    setShowSuggestions(false);
  };

  const onSubmit = async (data: FormValues) => {
    try {
      await db.insert(contacts).values({
        name: data.name,
        phoneNumber: data.phone,
        category: data.category,
        notes: data.note || null,
      });

      Toast.show({
        type: "success",
        text1: "Berhasil!",
        text2: "Kontak berhasil disimpan",
      });

      router.back();
    } catch (error) {
      console.error(error);
      Toast.show({
        type: "error",
        text1: "Gagal!",
        text2: "Terjadi kesalahan saat menyimpan",
      });
    }
  };

  return (
    <Container>
      <Stack.Screen options={{ title: "Tambah Kontak" }} />
      <View style={styles.form}>
        <Text style={styles.label}>Nama</Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <View>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                placeholder="Nama lengkap"
                onFocus={() => {
                  loadPhoneContacts();
                  setShowSuggestions(true);
                }}
                onBlur={onBlur}
                onChangeText={(text) => {
                  onChange(text);
                  setShowSuggestions(true);
                }}
                value={value}
                returnKeyType="next"
              />
              {showSuggestions && value.length > 1 && (
                <View style={styles.dropdown}>
                  {phoneContacts
                    .filter((c) => c.name.toLowerCase().includes(value.toLowerCase()))
                    .slice(0, 5)
                    .map((contact, i) => (
                      <Pressable key={i} style={styles.option} onPress={() => selectContact(contact)}>
                        <Text style={{ fontWeight: "bold" }}>{contact.name}</Text>
                        <Text style={{ fontSize: 12, color: "gray" }}>{contact.phoneNumbers?.[0]?.number}</Text>
                      </Pressable>
                    ))}
                </View>
              )}
            </View>
          )}
        />
        {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}

        <Text style={styles.label}>Nomor Telepon</Text>
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="Nomor Telepon"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              keyboardType="phone-pad"
            />
          )}
        />
        {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}

        <Text style={styles.label}>Kategori</Text>
        <Controller
          control={control}
          name="category"
          render={({ field: { onChange, value } }) => {
            const options = [
              { label: "Supplier", value: "supplier" },
              { label: "Langganan", value: "langganan" },
              { label: "Supir", value: "supir" },
              { label: "Lainnya", value: "lainnya" },
            ];

            return (
              <>
                <Pressable
                  style={[styles.input, errors.category && styles.inputError]}
                  onPress={() => setCategoryOpen((s) => !s)}
                >
                  <Text style={{ color: value ? Colors.text : Colors.border }}>
                    {value ? options.find((o) => o.value === value)?.label : "Pilih kategori"}
                  </Text>
                </Pressable>

                {categoryOpen && (
                  <View style={styles.dropdown}>
                    {options.map((opt) => (
                      <Pressable
                        key={opt.value}
                        style={styles.option}
                        onPress={() => {
                          onChange(opt.value);
                          setCategoryOpen(false);
                        }}
                      >
                        <Text>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            );
          }}
        />
        {errors.category && <Text style={styles.error}>{errors.category.message}</Text>}

        <Text style={styles.label}>Catatan (opsional)</Text>
        <Controller
          control={control}
          name="note"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Catatan singkat"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              multiline
              numberOfLines={3}
            />
          )}
        />

        <Pressable
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>Simpan</Text>
        </Pressable>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  form: {
    marginTop: Spacing.sm,
  },
  label: {
    color: Colors.text,
    marginBottom: Spacing.xs,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.secondary,
    marginBottom: Spacing.sm,
    color: Colors.text,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  dropdown: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.background,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  option: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.secondary,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  error: {
    color: Colors.danger,
    marginBottom: Spacing.sm,
  },
  button: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
});

import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

export const DATABASE_NAME = "kayuping.db";
export const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
expoDb.execAsync("PRAGMA foreign_keys = ON;");

export const db = drizzle(expoDb, { schema });

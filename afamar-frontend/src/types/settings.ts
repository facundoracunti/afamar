// Settings entry type. Field names are kept in Spanish to match
// the form layer (ConfigurationPage.tsx).

export interface Setting {
  key: string;
  value: string;
}

export type SettingsMap = Record<string, string>;

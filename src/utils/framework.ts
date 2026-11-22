export const PUBLIC_PREFIXES = [
  "NEXT_PUBLIC_",
  "VITE_",
  "REACT_APP_",
  "EXPO_PUBLIC_",
  "NUXT_PUBLIC_",
  "GATSBY_",
  "PUBLIC_"
] as const;

export const SENSITIVE_KEY_WORDS = [
  "SECRET",
  "PASSWORD",
  "PASSWD",
  "PRIVATE_KEY",
  "PRIVATE",
  "API_KEY",
  "APIKEY",
  "AUTH_TOKEN",
  "TOKEN",
  "CREDENTIAL",
  "SIGNING_KEY",
  "CERTIFICATE",
  "SSH_KEY"
];

/**
 * Checks whether an environment variable name starts with a known public framework prefix.
 */
export function isPublicFrameworkVariable(key: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Checks if a public framework variable appears to contain sensitive naming.
 */
export function isPublicVariableWithSensitiveName(key: string): boolean {
  if (!isPublicFrameworkVariable(key)) return false;

  const upper = key.toUpperCase();
  return SENSITIVE_KEY_WORDS.some((word) => upper.includes(word));
}

/**
 * Returns framework name based on variable prefix.
 */
export function getFrameworkName(key: string): string | null {
  if (key.startsWith("NEXT_PUBLIC_")) return "Next.js";
  if (key.startsWith("VITE_")) return "Vite";
  if (key.startsWith("REACT_APP_")) return "Create React App";
  if (key.startsWith("EXPO_PUBLIC_")) return "Expo";
  if (key.startsWith("NUXT_PUBLIC_")) return "Nuxt";
  if (key.startsWith("GATSBY_")) return "Gatsby";
  if (key.startsWith("PUBLIC_")) return "Generic Public Framework";
  return null;
}

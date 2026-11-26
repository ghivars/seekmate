import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";

const config = [
  ...next,
  ...ts,
  { ignores: [".next/**", "src/lib/api/schema.d.ts"] },
  { rules: { "@typescript-eslint/no-explicit-any": "error" } },
];
export default config;

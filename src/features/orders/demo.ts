export function demoCheckoutEnabled(
  environment: string | undefined,
  flag: string | undefined,
) {
  return environment !== "production" && flag === "true";
}

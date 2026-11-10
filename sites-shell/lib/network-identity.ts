const normalizeIpv4 = (value: string) => {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const normalized = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return null;
    const number = Number(part);
    return number >= 0 && number <= 255 ? String(number) : null;
  });
  return normalized.every((part): part is string => part !== null)
    ? normalized.join(".")
    : null;
};

const ipv4ToIpv6Groups = (value: string) => {
  const normalized = normalizeIpv4(value);
  if (!normalized) return null;
  const bytes = normalized.split(".").map(Number);
  return [
    ((bytes[0] << 8) | bytes[1]).toString(16),
    ((bytes[2] << 8) | bytes[3]).toString(16),
  ];
};

const normalizeIpv6Prefix = (value: string) => {
  const address = value.toLowerCase().split("%")[0];
  if ((address.match(/::/g) ?? []).length > 1) return null;
  const [head = "", tail = ""] = address.split("::");
  const convertIpv4Tail = (groups: string[]) => {
    const last = groups.at(-1);
    if (!last?.includes(".")) return groups;
    const converted = ipv4ToIpv6Groups(last);
    return converted ? [...groups.slice(0, -1), ...converted] : [];
  };
  const headGroups = convertIpv4Tail(head ? head.split(":") : []);
  const tailGroups = convertIpv4Tail(tail ? tail.split(":") : []);
  const missing = 8 - headGroups.length - tailGroups.length;
  if (missing < 0 || (!address.includes("::") && missing !== 0)) return null;
  const groups = [
    ...headGroups,
    ...Array.from({ length: missing }, () => "0"),
    ...tailGroups,
  ];
  if (
    groups.length !== 8
    || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))
  ) return null;
  return groups.slice(0, 4).map((group) => group.padStart(4, "0")).join(":");
};

export const normalizedNetworkAddress = (addressValue: string | null | undefined) => {
  const address = addressValue?.trim() ?? "";
  const ipv4 = normalizeIpv4(address);
  if (ipv4) return `ipv4:${ipv4}`;
  const mappedIpv4 = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)?.[1];
  const normalizedMappedIpv4 = mappedIpv4 ? normalizeIpv4(mappedIpv4) : null;
  if (normalizedMappedIpv4) return `ipv4:${normalizedMappedIpv4}`;
  const ipv6Prefix = normalizeIpv6Prefix(address);
  return ipv6Prefix ? `ipv6-64:${ipv6Prefix}` : null;
};

export const normalizedClientNetwork = (request: Request) => normalizedNetworkAddress(
  request.headers.get("cf-connecting-ip")
  ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
);

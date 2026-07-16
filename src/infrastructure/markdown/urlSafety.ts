import dns from "node:dns";
import net from "node:net";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * IPv4 ranges that must never be reachable from a server-side "fetch this URL" endpoint:
 * loopback, RFC1918 private space, link-local (this also covers the 169.254.169.254
 * cloud metadata endpoint), carrier-grade NAT, and "this network".
 */
const PRIVATE_IPV4_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isIpv4InRange(ip: string, range: string, prefixLength: number): boolean {
  const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range) & mask);
}

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_IPV4_RANGES.some(([range, prefix]) => isIpv4InRange(ip, range, prefix));
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9")) return true; // fe80::/10
  if (normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7 (ULA)

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — check the embedded IPv4 address too.
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);

  return false;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateIpv6(ip);
  return true; // not a recognizable IP — refuse rather than risk it
}

export class UnsafeUrlError extends Error {}

/**
 * Validates that a URL is safe for the server to fetch: http(s) only, and every
 * resolved address for its hostname is public (blocks loopback/private/link-local,
 * including cloud metadata endpoints like 169.254.169.254).
 *
 * Note: this resolves DNS once up front; it does not pin the fetch to the checked
 * IP, so a theoretical DNS-rebinding attack between check and fetch is out of scope
 * for this demo-grade guard (a production hardening would use a custom dispatcher
 * that fetches the pinned, already-checked address).
 */
export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError(`Unsupported protocol: ${url.protocol}`);
  }

  const hostname = url.hostname;

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new UnsafeUrlError("Refusing to fetch a private/reserved IP address");
    }
    return;
  }

  const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) {
    throw new UnsafeUrlError("Hostname did not resolve to any address");
  }

  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new UnsafeUrlError("Refusing to fetch a hostname that resolves to a private/reserved IP");
    }
  }
}

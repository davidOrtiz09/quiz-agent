import { describe, expect, it } from "vitest";
import { assertSafeUrl, isPrivateOrReservedIp, UnsafeUrlError } from "@/infrastructure/markdown/urlSafety";

describe("isPrivateOrReservedIp", () => {
  it("flags loopback addresses", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
  });

  it("flags RFC1918 private ranges", () => {
    expect(isPrivateOrReservedIp("10.1.2.3")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.5.4")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
  });

  it("flags link-local addresses, including the cloud metadata endpoint", () => {
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
  });

  it("flags IPv4-mapped IPv6 addresses that embed a private IPv4", () => {
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("flags IPv6 unique-local addresses", () => {
    expect(isPrivateOrReservedIp("fc00::1")).toBe(true);
    expect(isPrivateOrReservedIp("fd12:3456::1")).toBe(true);
  });

  it("allows public IPv4 addresses", () => {
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("140.82.112.3")).toBe(false); // github.com
  });
});

describe("assertSafeUrl", () => {
  it("rejects non-http(s) protocols", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow(UnsafeUrlError);
  });

  it("rejects an invalid URL", async () => {
    await expect(assertSafeUrl("not a url")).rejects.toThrow(UnsafeUrlError);
  });

  it("rejects a literal loopback IP", async () => {
    await expect(assertSafeUrl("http://127.0.0.1/README.md")).rejects.toThrow(UnsafeUrlError);
  });

  it("rejects the literal cloud metadata address", async () => {
    await expect(assertSafeUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(UnsafeUrlError);
  });

  it("rejects a literal private-range IP", async () => {
    await expect(assertSafeUrl("http://10.0.0.5/x")).rejects.toThrow(UnsafeUrlError);
  });
});

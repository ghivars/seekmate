import { expect, it } from "vitest";
import { abbr } from "./abbr";

it.each([
  ["Algoritma dan Pemrograman", "ALP"],
  ["Kalkulus I", "KLK"],
  ["Basis Data", "BSD"],
  ["Pengantar Ekonomi Mikro", "PEM"],
  ["UX", "UXX"],
])("%s -> %s", (name, expected) => expect(abbr(name)).toBe(expected));

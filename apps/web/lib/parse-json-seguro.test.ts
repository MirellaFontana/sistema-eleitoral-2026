import { describe, it, expect } from "vitest";
import { parseJsonSeguro } from "./parse-json-seguro";

describe("parseJsonSeguro", () => {
  it("parses clean JSON", () => {
    const result = parseJsonSeguro('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  it("strips markdown code fences", () => {
    const result = parseJsonSeguro('```json\n{"a": 1}\n```');
    expect(result).toEqual({ a: 1 });
  });

  it("extracts JSON from prose before and after", () => {
    const result = parseJsonSeguro('Here is the analysis:\n{"resumo": "ok"}\n\nHope this helps!');
    expect(result).toEqual({ resumo: "ok" });
  });

  it("handles nested objects with balanced braces", () => {
    const input = 'Sure!\n{"outer": {"inner": "value"}, "list": [1,2]}\nDone.';
    const result = parseJsonSeguro(input);
    expect(result).toEqual({ outer: { inner: "value" }, list: [1, 2] });
  });

  it("handles braces inside string values", () => {
    const input = '{"msg": "use {curly} braces", "n": 1}';
    const result = parseJsonSeguro(input);
    expect(result).toEqual({ msg: "use {curly} braces", n: 1 });
  });

  it("handles escaped quotes inside strings", () => {
    const input = '{"msg": "she said \\"hello\\"", "n": 2}';
    const result = parseJsonSeguro(input);
    expect(result).toEqual({ msg: 'she said "hello"', n: 2 });
  });

  it("returns null for no JSON", () => {
    expect(parseJsonSeguro("no json here")).toBeNull();
  });

  it("returns null for unclosed braces", () => {
    expect(parseJsonSeguro('{"key": "value"')).toBeNull();
  });

  it("extracts first valid JSON object when trailing garbage exists", () => {
    const input = '{"valid": true} and then some garbage {broken';
    const result = parseJsonSeguro(input);
    expect(result).toEqual({ valid: true });
  });

  it("handles empty object", () => {
    expect(parseJsonSeguro("{}")).toEqual({});
  });
});

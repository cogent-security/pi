import { describe, expect, it } from "vitest";
import { parseFrontmatter, stripFrontmatter } from "../src/utils/frontmatter.ts";

describe("parseFrontmatter", () => {
	it("parses keys, strips quotes, and returns body", () => {
		const input = "---\nname: \"skill-name\"\ndescription: 'A desc'\nfoo-bar: value\n---\n\nBody text";
		const { frontmatter, body } = parseFrontmatter<Record<string, string>>(input);
		expect(frontmatter.name).toBe("skill-name");
		expect(frontmatter.description).toBe("A desc");
		expect(frontmatter["foo-bar"]).toBe("value");
		expect(body).toBe("Body text");
	});

	it("normalizes newlines and handles CRLF", () => {
		const input = "---\r\nname: test\r\n---\r\nLine one\r\nLine two";
		const { body } = parseFrontmatter<Record<string, string>>(input);
		expect(body).toBe("Line one\nLine two");
	});

	it("throws on invalid YAML frontmatter", () => {
		const input = "---\nfoo: [bar\n---\nBody";
		expect(() => parseFrontmatter<Record<string, string>>(input)).toThrow(/at line 1, column 10/);
	});

	it("falls back to line-by-line parsing in tolerant mode", () => {
		const input = "---\nfoo: [bar\n---\nBody";
		const { frontmatter, body } = parseFrontmatter<Record<string, string>>(input, { tolerant: true });
		expect(frontmatter.foo).toBe("[bar");
		expect(body).toBe("Body");
	});

	it("tolerant mode parses skill-like frontmatter with bracket argument-hints", () => {
		const input =
			"---\nname: my-skill\ndescription: A skill that does things\nargument-hint: [deploy <sha?> | rollback [urgent] | report]\n---\n\nBody text";
		const { frontmatter, body } = parseFrontmatter<Record<string, string>>(input, { tolerant: true });
		expect(frontmatter.name).toBe("my-skill");
		expect(frontmatter.description).toBe("A skill that does things");
		expect(frontmatter["argument-hint"]).toBe("[deploy <sha?> | rollback [urgent] | report]");
		expect(body).toBe("Body text");
	});

	it("tolerant mode handles multiple bracket groups in argument-hint", () => {
		const input =
			"---\nname: cgcreatespec\ndescription: Create a feature spec\nargument-hint: [linear-ticket] [description...]\n---\n\nBody";
		const { frontmatter } = parseFrontmatter<Record<string, string>>(input, { tolerant: true });
		expect(frontmatter.name).toBe("cgcreatespec");
		expect(frontmatter["argument-hint"]).toBe("[linear-ticket] [description...]");
	});

	it("tolerant mode handles boolean values", () => {
		const input = "---\ndisable-model-invocation: true\nenabled: false\n---\nBody";
		const { frontmatter } = parseFrontmatter(input, { tolerant: true });
		expect(frontmatter["disable-model-invocation"]).toBe(true);
		expect(frontmatter.enabled).toBe(false);
	});

	it("tolerant mode handles multiline block scalar values", () => {
		const input = "---\ndescription: |\n  Line one\n  Line two\nname: test\n---\nBody";
		const { frontmatter } = parseFrontmatter<Record<string, string>>(input, { tolerant: true });
		// Valid YAML should still parse via the yaml library
		expect(frontmatter.description).toBe("Line one\nLine two\n");
		expect(frontmatter.name).toBe("test");
	});

	it("tolerant mode still uses yaml library for valid YAML", () => {
		const input = '---\nname: "skill-name"\ndescription: A desc\n---\nBody';
		const { frontmatter } = parseFrontmatter<Record<string, string>>(input, { tolerant: true });
		expect(frontmatter.name).toBe("skill-name");
		expect(frontmatter.description).toBe("A desc");
	});

	it("parses | multiline yaml syntax", () => {
		const input = "---\ndescription: |\n  Line one\n  Line two\n---\n\nBody";
		const { frontmatter, body } = parseFrontmatter<Record<string, string>>(input);
		expect(frontmatter.description).toBe("Line one\nLine two\n");
		expect(body).toBe("Body");
	});

	it("returns original content when frontmatter is missing or unterminated", () => {
		const noFrontmatter = "Just text\nsecond line";
		const missingEnd = "---\nname: test\nBody without terminator";
		const resultNoFrontmatter = parseFrontmatter<Record<string, string>>(noFrontmatter);
		const resultMissingEnd = parseFrontmatter<Record<string, string>>(missingEnd);
		expect(resultNoFrontmatter.body).toBe("Just text\nsecond line");
		expect(resultMissingEnd.body).toBe(
			"---\nname: test\nBody without terminator".replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
		);
	});

	it("returns empty object for empty or comment-only frontmatter", () => {
		const input = "---\n# just a comment\n---\nBody";
		const { frontmatter } = parseFrontmatter(input);
		expect(frontmatter).toEqual({});
	});
});

describe("stripFrontmatter", () => {
	it("removes frontmatter and trims body", () => {
		const input = "---\nkey: value\n---\n\nBody\n";
		expect(stripFrontmatter(input)).toBe("Body");
	});

	it("returns body when no frontmatter present", () => {
		const input = "\n  No frontmatter body  \n";
		expect(stripFrontmatter(input)).toBe("\n  No frontmatter body  \n");
	});
});

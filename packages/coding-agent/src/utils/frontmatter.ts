import { parse } from "yaml";

type ParsedFrontmatter<T extends Record<string, unknown>> = {
	frontmatter: T;
	body: string;
};

export interface ParseFrontmatterOptions {
	/** When true, fall back to line-by-line key:value parsing on YAML errors instead of throwing. */
	tolerant?: boolean;
}

const normalizeNewlines = (value: string): string => value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

const extractFrontmatter = (content: string): { yamlString: string | null; body: string } => {
	const normalized = normalizeNewlines(content);

	if (!normalized.startsWith("---")) {
		return { yamlString: null, body: normalized };
	}

	const endIndex = normalized.indexOf("\n---", 3);
	if (endIndex === -1) {
		return { yamlString: null, body: normalized };
	}

	return {
		yamlString: normalized.slice(4, endIndex),
		body: normalized.slice(endIndex + 4).trim(),
	};
};

/**
 * Fallback parser for frontmatter that isn't valid YAML.
 * Extracts simple `key: value` pairs line by line, treating values as raw strings.
 * Handles multiline values using YAML block scalar indicators (| and >).
 */
function parseFrontmatterLineByLine(yamlString: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const lines = yamlString.split("\n");
	let currentKey: string | null = null;
	let multilineValue: string[] = [];
	let isMultiline = false;

	const flushMultiline = () => {
		if (currentKey && isMultiline) {
			result[currentKey] = multilineValue.join("\n").trimEnd();
			if (result[currentKey] === "") {
				result[currentKey] = "";
			}
		}
		currentKey = null;
		multilineValue = [];
		isMultiline = false;
	};

	for (const line of lines) {
		// If we're collecting multiline content
		if (isMultiline) {
			// A non-indented line with key: pattern ends the multiline block
			if (/^[a-zA-Z0-9_-]+\s*:/.test(line)) {
				flushMultiline();
				// Fall through to process this line as a new key
			} else {
				// Strip common leading indent (2 spaces)
				const stripped = line.startsWith("  ") ? line.slice(2) : line;
				multilineValue.push(stripped);
				continue;
			}
		}

		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) {
			continue;
		}

		const key = line.slice(0, colonIndex).trim();
		let value = line.slice(colonIndex + 1).trim();

		if (!key) {
			continue;
		}

		// Check for block scalar indicators
		if (value === "|" || value === ">") {
			currentKey = key;
			isMultiline = true;
			multilineValue = [];
			continue;
		}

		// Strip surrounding quotes
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}

		// Convert boolean-ish values
		if (value === "true") {
			result[key] = true;
		} else if (value === "false") {
			result[key] = false;
		} else {
			result[key] = value;
		}
	}

	flushMultiline();
	return result;
}

export const parseFrontmatter = <T extends Record<string, unknown> = Record<string, unknown>>(
	content: string,
	options?: ParseFrontmatterOptions,
): ParsedFrontmatter<T> => {
	const { yamlString, body } = extractFrontmatter(content);
	if (!yamlString) {
		return { frontmatter: {} as T, body };
	}
	try {
		const parsed = parse(yamlString);
		return { frontmatter: (parsed ?? {}) as T, body };
	} catch (error) {
		if (options?.tolerant) {
			const fallback = parseFrontmatterLineByLine(yamlString);
			return { frontmatter: fallback as T, body };
		}
		throw error;
	}
};

export const stripFrontmatter = (content: string): string => parseFrontmatter(content).body;

import { describe, it, expect } from "vitest";
import {
  ErrorLocationExtractor,
  createErrorLocationExtractor,
  extractErrorLocation,
  extractAllErrorLocations,
  extractLocationForFormat,
  hasErrorLocation,
  formatErrorLocation,
  type ErrorLocation,
} from "@/lib/preview/error-location-extractor";

describe("ErrorLocationExtractor", () => {
  describe("SCSS error formats", () => {
    it("extracts from dart-sass format: file.scss:line:col:", () => {
      const error = "styles/theme.scss:25:10: Error: Undefined variable";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("styles/theme.scss");
      expect(location.line).toBe(25);
      expect(location.column).toBe(10);
      expect(location.format).toBe("scss");
      expect(location.confidence).toBe("high");
    });

    it("extracts from 'on line X of file.scss' format", () => {
      const error = "Error: Undefined variable $primary on line 15 of styles/main.scss";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("styles/main.scss");
      expect(location.line).toBe(15);
      expect(location.format).toBe("scss");
    });

    it("extracts from 'at file.scss:line' format", () => {
      const error = "Compilation failed at src/variables.scss:42";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("src/variables.scss");
      expect(location.line).toBe(42);
      expect(location.format).toBe("scss");
    });
  });

  describe("QWeb error formats", () => {
    it("extracts from [QWeb ERROR] format with column", () => {
      const error = "[QWeb ERROR] templates/widget.xml:100:5 [my.widget]: Missing directive";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("templates/widget.xml");
      expect(location.line).toBe(100);
      expect(location.column).toBe(5);
      expect(location.format).toBe("qweb");
      expect(location.confidence).toBe("high");
    });

    it("extracts from [QWeb WARNING] format without column", () => {
      const error = "[QWeb WARNING] snippet.xml:50: Deprecated directive";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("snippet.xml");
      expect(location.line).toBe(50);
      expect(location.column).toBeNull();
      expect(location.format).toBe("qweb");
    });
  });

  describe("Python error formats", () => {
    it("extracts from Python traceback format", () => {
      const error = 'File "/app/main.py", line 42, in run_server';
      const location = extractErrorLocation(error);

      expect(location.file).toBe("/app/main.py");
      expect(location.line).toBe(42);
      expect(location.format).toBe("python");
      expect(location.confidence).toBe("high");
    });

    it("extracts from Python traceback without function name", () => {
      const error = 'File "src/utils.py", line 100';
      const location = extractErrorLocation(error);

      expect(location.file).toBe("src/utils.py");
      expect(location.line).toBe(100);
      expect(location.format).toBe("python");
    });

    it("extracts from Python syntax error format", () => {
      const error = "script.py:15:10: SyntaxError: invalid syntax";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("script.py");
      expect(location.line).toBe(15);
      expect(location.column).toBe(10);
      expect(location.format).toBe("python");
    });

    it("extracts from simple Python file:line format", () => {
      const error = "mymodule.py:25: DeprecationWarning";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("mymodule.py");
      expect(location.line).toBe(25);
      expect(location.format).toBe("python");
    });

    it("extracts from multi-line Python traceback", () => {
      const error = `Traceback (most recent call last):
  File "/app/main.py", line 10, in <module>
    from utils import helper
  File "/app/utils.py", line 5, in <module>
    raise ImportError("Missing dependency")
ImportError: Missing dependency`;

      const locations = extractAllErrorLocations(error);

      expect(locations.length).toBeGreaterThanOrEqual(2);
      expect(locations.some((l) => l.file === "/app/main.py" && l.line === 10)).toBe(true);
      expect(locations.some((l) => l.file === "/app/utils.py" && l.line === 5)).toBe(true);
    });
  });

  describe("TypeScript error formats", () => {
    it("extracts from parentheses format: file.ts(line,col):", () => {
      const error = "src/app.ts(42,15): error TS2322: Type mismatch";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("src/app.ts");
      expect(location.line).toBe(42);
      expect(location.column).toBe(15);
      expect(location.format).toBe("typescript");
      expect(location.confidence).toBe("high");
    });

    it("extracts from colon format: file.ts:line:col - error", () => {
      const error = "src/index.tsx:10:5 - error TS1005: ';' expected.";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("src/index.tsx");
      expect(location.line).toBe(10);
      expect(location.column).toBe(5);
      expect(location.format).toBe("typescript");
    });
  });

  describe("JavaScript error formats", () => {
    it("extracts from stack trace with function: at Fn (file:line:col)", () => {
      const error = "TypeError: Cannot read property\n    at Array.map (utils.js:25:12)";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("utils.js");
      expect(location.line).toBe(25);
      expect(location.column).toBe(12);
      expect(location.format).toBe("javascript");
    });

    it("extracts from stack trace: at file:line:col", () => {
      const error = "Error: Something went wrong\n    at /app/server.js:100:5";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("/app/server.js");
      expect(location.line).toBe(100);
      expect(location.column).toBe(5);
    });
  });

  describe("ESLint/Prettier formats", () => {
    it("extracts from ESLint format", () => {
      const error = "src/components/Button.tsx:30:15: Unexpected token";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("src/components/Button.tsx");
      expect(location.line).toBe(30);
      expect(location.column).toBe(15);
      expect(location.format).toBe("eslint");
    });
  });

  describe("generic formats", () => {
    it("extracts from generic file:line:col format", () => {
      const error = "Error in config.json:5:10";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("config.json");
      expect(location.line).toBe(5);
      expect(location.column).toBe(10);
      expect(location.format).toBe("generic");
    });

    it("extracts from generic file:line format", () => {
      const error = "Problem in data.xml:100";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("data.xml");
      expect(location.line).toBe(100);
      expect(location.format).toBe("generic");
    });

    it("extracts from 'line X in file' format", () => {
      const error = "Syntax error on line 42 in template.html";
      const location = extractErrorLocation(error);

      expect(location.file).toBe("template.html");
      expect(location.line).toBe(42);
      expect(location.format).toBe("generic");
    });
  });

  describe("no location found", () => {
    it("returns unknown format for messages without location", () => {
      const error = "Something went wrong";
      const location = extractErrorLocation(error);

      expect(location.file).toBeNull();
      expect(location.line).toBeNull();
      expect(location.column).toBeNull();
      expect(location.format).toBe("unknown");
    });
  });
});

describe("extractAllErrorLocations", () => {
  it("extracts multiple locations from stack trace", () => {
    const error = `Error: Test failed
    at runTest (test.js:10:5)
    at Suite.run (suite.js:25:10)
    at Runner.execute (runner.js:100:3)`;

    const locations = extractAllErrorLocations(error);

    // Multiple patterns may match, so we check that at least 3 unique file:line combos are found
    expect(locations.length).toBeGreaterThanOrEqual(3);
    expect(locations.some((l) => l.file === "test.js" && l.line === 10)).toBe(true);
    expect(locations.some((l) => l.file === "suite.js" && l.line === 25)).toBe(true);
    expect(locations.some((l) => l.file === "runner.js" && l.line === 100)).toBe(true);
  });

  it("deduplicates identical locations", () => {
    const error = `Error at file.js:10:5
    Repeated at file.js:10:5`;

    const locations = extractAllErrorLocations(error);

    const count = locations.filter((l) => l.file === "file.js" && l.line === 10).length;
    expect(count).toBe(1);
  });

  it("sorts by confidence then line number", () => {
    const error = `Generic error in helper.ts:50
src/app.ts(10,5): error TS2322: Type error`;

    const locations = extractAllErrorLocations(error);

    // TypeScript (high confidence) should come before generic (low confidence)
    expect(locations[0].format).toBe("typescript");
    expect(locations[0].confidence).toBe("high");
  });
});

describe("extractLocationForFormat", () => {
  it("extracts only matching format", () => {
    const error = "src/app.ts(10,5): error and also styles.scss:20:3: error";

    const tsLocation = extractLocationForFormat(error, "typescript");
    expect(tsLocation?.file).toBe("src/app.ts");
    expect(tsLocation?.line).toBe(10);

    const scssLocation = extractLocationForFormat(error, "scss");
    expect(scssLocation?.file).toBe("styles.scss");
    expect(scssLocation?.line).toBe(20);
  });

  it("returns null when format not found", () => {
    const error = "src/app.ts(10,5): error";
    const location = extractLocationForFormat(error, "python");

    expect(location).toBeNull();
  });
});

describe("hasErrorLocation", () => {
  it("returns true when location found", () => {
    expect(hasErrorLocation("file.ts:10:5: error")).toBe(true);
  });

  it("returns false when no location found", () => {
    expect(hasErrorLocation("Generic error message")).toBe(false);
  });
});

describe("formatErrorLocation", () => {
  it("formats complete location", () => {
    const location: ErrorLocation = {
      file: "src/app.ts",
      line: 42,
      column: 15,
      endLine: null,
      endColumn: null,
      format: "typescript",
      confidence: "high",
    };

    expect(formatErrorLocation(location)).toBe("src/app.ts:42:15");
  });

  it("formats location without column", () => {
    const location: ErrorLocation = {
      file: "main.py",
      line: 100,
      column: null,
      endLine: null,
      endColumn: null,
      format: "python",
      confidence: "high",
    };

    expect(formatErrorLocation(location)).toBe("main.py:100");
  });

  it("formats location without file", () => {
    const location: ErrorLocation = {
      file: null,
      line: 50,
      column: null,
      endLine: null,
      endColumn: null,
      format: "unknown",
      confidence: "low",
    };

    expect(formatErrorLocation(location)).toBe("(unknown file):50");
  });

  it("formats unknown location", () => {
    const location: ErrorLocation = {
      file: null,
      line: null,
      column: null,
      endLine: null,
      endColumn: null,
      format: "unknown",
      confidence: "low",
    };

    expect(formatErrorLocation(location)).toBe("(unknown location)");
  });
});

describe("createErrorLocationExtractor", () => {
  it("creates extractor instance", () => {
    const extractor = createErrorLocationExtractor();
    expect(extractor).toBeInstanceOf(ErrorLocationExtractor);
  });
});

describe("verification: extracts location from various error formats (SCSS, QWeb, Python)", () => {
  it("extracts file/line/column from SCSS errors", () => {
    const scssErrors = [
      "styles/theme.scss:25:10: Error: Undefined variable",
      "Error on line 15 of styles/main.scss: $color not found",
      "Compilation failed at src/variables.scss:42:5",
    ];

    for (const error of scssErrors) {
      const location = extractErrorLocation(error);
      expect(location.file).toBeTruthy();
      expect(location.file).toContain(".scss");
      expect(location.line).toBeGreaterThan(0);
    }
  });

  it("extracts file/line/column from QWeb errors", () => {
    const qwebErrors = [
      "[QWeb ERROR] templates/widget.xml:100:5 [my.widget]: Missing t-as",
      "[QWeb WARNING] snippet.xml:50: Deprecated directive t-raw",
    ];

    for (const error of qwebErrors) {
      const location = extractErrorLocation(error);
      expect(location.file).toBeTruthy();
      expect(location.file).toContain(".xml");
      expect(location.line).toBeGreaterThan(0);
      expect(location.format).toBe("qweb");
    }
  });

  it("extracts file/line/column from Python errors", () => {
    const pythonErrors = [
      'File "/app/main.py", line 42, in run_server',
      "script.py:15:10: SyntaxError: invalid syntax",
      'File "src/utils.py", line 100',
      "mymodule.py:25: DeprecationWarning: old API",
    ];

    for (const error of pythonErrors) {
      const location = extractErrorLocation(error);
      expect(location.file).toBeTruthy();
      expect(location.file).toContain(".py");
      expect(location.line).toBeGreaterThan(0);
      expect(location.format).toBe("python");
    }
  });

  it("provides confidence levels for extractions", () => {
    // High confidence: specific format indicators
    const highConf = extractErrorLocation("[QWeb ERROR] template.xml:10:5: error");
    expect(highConf.confidence).toBe("high");

    // Low confidence: generic patterns
    const lowConf = extractErrorLocation("Error in unknown.xyz:10");
    expect(lowConf.confidence).toBe("low");
  });
});

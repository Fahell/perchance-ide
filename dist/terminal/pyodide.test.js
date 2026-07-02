import { describe, it, expect } from "vitest";
import { installPackage } from "./pyodide.js";
describe("installPackage - security validation", () => {
    it("should reject package names with injection attempts", async () => {
        const maliciousNames = [
            'test"); import os; os.system("malicious") #',
            'test\\"',
            'test\nimport os',
            'test{__import__("os")}',
            'test; print("x")',
            'test`echo x`',
            'test$(whoami)',
            '',
            '   ',
            '-invalid',
            'invalid-',
            '.invalid',
            'invalid.',
            '_invalid',
            'invalid_',
            'test@package',
            'test#comment',
            'test$var',
            'test%percent',
            'test&ampersand',
            'test*star',
            'test(paren)',
            'test[bracket]',
            'test{brace}',
            'test|pipe',
            'test<angle>',
            'test?question',
            'test!exclaim',
            'test~tilde',
            'test`backtick`',
        ];
        for (const name of maliciousNames) {
            const result = await installPackage(name);
            expect(result).toMatch(/^Error: Invalid package name/);
        }
    });
    it("should accept valid package names according to PEP 508 (validation only)", async () => {
        const validNames = [
            'numpy',
            'pandas',
            'requests',
            'beautifulsoup4',
            'scikit-learn',
            'my_package',
            'package.name',
            'Package123',
            'a',
            'A1',
            'my-package',
            'my_package_name',
            'my.package.name',
            'Package-With-Mixed-Case',
            'package123',
            '123package',
        ];
        for (const name of validNames) {
            try {
                const result = await installPackage(name);
                // Should NOT return validation error
                expect(result).not.toMatch(/^Error: Invalid package name/);
            }
            catch (err) {
                // In test environment, Pyodide will fail to load, but that's OK
                // The important thing is that validation passed (no validation error thrown)
                // If validation failed, it would return a string error, not throw
                expect(err.message).not.toContain('Invalid package name');
            }
        }
    });
    it("should reject names with spaces", async () => {
        const namesWithSpaces = [
            'test package',
            ' test',
            'test ',
            'te st',
        ];
        for (const name of namesWithSpaces) {
            const result = await installPackage(name);
            expect(result).toMatch(/^Error: Invalid package name/);
        }
    });
    it("should reject names with special characters", async () => {
        const specialCharNames = [
            'test@package',
            'test#comment',
            'test$var',
            'test%percent',
            'test&ampersand',
            'test*star',
            'test(paren)',
            'test[bracket]',
            'test{brace}',
            'test|pipe',
            'test<angle>',
            'test?question',
            'test!exclaim',
            'test~tilde',
            'test`backtick`',
            'test"quote',
            "test'apostrophe",
            'test\\backslash',
            'test/slash',
            'test:colon',
            'test;semicolon',
            'test,comma',
        ];
        for (const name of specialCharNames) {
            const result = await installPackage(name);
            expect(result).toMatch(/^Error: Invalid package name/);
        }
    });
    it("should provide clear error message with expected format", async () => {
        const result = await installPackage('invalid@name');
        expect(result).toContain('PEP 508');
        expect(result).toContain('letters, numbers, dots, underscores, and hyphens');
        expect(result).toContain('start/end with alphanumeric');
    });
});

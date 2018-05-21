/**
 * Copyright 2017 Trim-marks Inc.
 *
 * Vivliostyle.js is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Vivliostyle.js is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Vivliostyle.js.  If not, see <http://www.gnu.org/licenses/>.
 */
module.exports = {
    "env": {
        "browser": true,
        "jasmine": true,
        "commonjs": true
    },
    "globals": {
        "adapt": false,
        "goog": false,
        "vivliostyle": false,
        "DataView": false
    },
    // "extends": "eslint:recommended",
    "rules": {
        // Possible Errors
        // (in recommended)
        "no-console": "error",
        "no-constant-condition": [
            "error",
            {
                "checkLoops": false
            }
        ],
        "no-empty": [
            "error",
            {
                "allowEmptyCatch": true
            }
        ],
        "no-inner-declarations": [
            "error",
            "functions"
        ],
        // (not in recommended)
        // "no-extra-parens": "off",
        // "no-prototype-builtins": "off",
        "no-template-curly-in-string": "error",
        "no-unsafe-negation": "error",
        // "valid-jsdoc": "off",

        // Best Practices
        // (not in recommended)
        "accessor-pairs": "error",
        "array-callback-return": "error",
        // "block-scoped-var": "off",
        // "complexity": "off",
        "consistent-return": "error",
        // "curly": "off",
        // "default-case": "off",
        "dot-location": [
            "error",
            "property"
        ],
        // "dot-notation": "off",
        // "eqeqeq": "off",
        // "guard-for-in": "off",
        "no-alert": "error",
        "no-caller": "error",
        "no-div-regex": "error",
        // "no-else-return": "off",
        // "no-empty-function": "off",
        // "no-eq-null": "off",
        "no-eval": "error",
        "no-extend-native": "error",
        "no-extra-bind": "error",
        "no-extra-label": "error",
        "no-floating-decimal": "error",
        "no-global-assign": "error",
        // "no-implicit-globals": "off",
        "no-implied-eval": "error",
        "no-invalid-this": "error",
        "no-iterator": "error",
        "no-labels": [
            "error",
            {
                "allowLoop": true,
                "allowSwitch": true
            }
        ],
        "no-lone-blocks": "error",
        // "no-loop-func": "off",
        // "no-magic-numbers": "off",
        // "no-multi-spaces": "off",
        "no-multi-str": "error",
        "no-new-func": "error",
        "no-new-wrappers": "error",
        "no-new": "error",
        "no-octal-escape": "error",
        // "no-param-reassign": "off",
        "no-proto": "error",
        // "no-return-assign": "off",
        "no-script-url": "error",
        "no-self-compare": "error",
        // "no-sequences": "off",
        // "no-throw-literal": "off",
        // "no-unmodified-loop-condition": "off",
        // "no-unused-expressions": "off",
        "no-useless-call": "error",
        "no-useless-concat": "error",
        // "no-useless-escape": "off",
        "no-void": "error",
        // "no-warning-comments": "off",
        "no-with": "error",
        "radix": [
            "error",
            "always"
        ],
        // "vars-on-top": "off",

        // Strict Mode
        // (not in recommended)
        // "strict": "off",

        // Variables
        // (in recommended)
        "no-undef": "error",
        "no-unused-vars": "off",
        // (not in recommended)
        // "init-declarations": "off",
        "no-catch-shadow": "error",
        "no-label-var": "error",
        "no-restricted-globals": "error",
        "no-shadow-restricted-names": "error",
        // "no-shadow": "off",
        "no-undef-init": "error",
        // "no-undefined": "off",
        // "no-use-before-define": "off",

        // Node.js and CommonJS
        // (not in recommended)
        // "callback-return": "off",
        "global-require": "error",
        "handle-callback-err": "error",
        "no-mixed-requires": "error",
        "no-new-require": "error",
        "no-path-concat": "error",
        "no-process-env": "error",
        "no-process-exit": "error",
        "no-restricted-modules": "error",
        "no-sync": "error",

        // Stylistic Issues
        // (in recommended)
        "no-mixed-spaces-and-tabs": "warn",
        // (not in recommended)
        "array-bracket-spacing": [
            "error",
            "never"
        ],
        // "block-spacing": "off",
        // "brace-style": "off",
        // "camelcase": "off",
        "comma-dangle": "error",
        "comma-spacing": "error",
        "comma-style": [
            "error",
            "last"
        ],
        // "computed-property-spacing": "off",
        // "consistent-this": "off",
        "eol-last": "warn",
        "func-call-spacing": [
            "error",
            "never"
        ],
        "func-names": [
            "error",
            "never"
        ],
        // "func-style": "off",
        "id-blacklist": "error",
        // "id-length": "off",
        "id-match": "error",
        "indent": [
            "warn",
            4,
            {
                "SwitchCase": 1
            }
        ],
        // "key-spacing": "off",
        "keyword-spacing": "error",
        "linebreak-style": [
            "error",
            "unix"
        ],
        // "lines-around-comment": "off",
        // "max-depth": "off",
        // "max-len": "off",
        // "max-lines": "off",
        "max-nested-callbacks": "error",
        // "max-params": "off",
        // "max-statements-per-line": "off",
        // "max-statements": "off",
        // "multiline-ternary": "off",
        "new-parens": "error",
        // "newline-after-var": "off",
        // "newline-before-return": "off",
        // "newline-per-chained-call": "off",
        "no-array-constructor": "error",
        // "no-bitwise": "off",
        // "no-continue": "off",
        // "no-inline-comments": "off",
        // "no-lonely-if": "off",
        // "no-mixed-operators": "off",
        // "no-multiple-empty-lines": "off",
        // "no-negated-condition": "off",
        // "no-nested-ternary": "off",
        "no-new-object": "error",
        // "no-plusplus": "off",
        "no-restricted-syntax": "error",
        // "no-tabs": "off",
        // "no-ternary": "off",
        "no-trailing-spaces": "warn",
        // "no-underscore-dangle": "off",
        "no-unneeded-ternary": [
            "error",
            {
                "defaultAssignment": true
            }
        ],
        "no-whitespace-before-property": "error",
        // "object-curly-newline": "off",
        // "object-curly-spacing": "off",
        // "object-property-newline": "off",
        // "one-var-declaration-per-line": "off",
        // "one-var": "off",
        // "operator-assignment": "off",
        // "operator-linebreak": "off",
        // "padded-blocks": "off",
        // "quote-props": "off",
        // "quotes": "off",
        // "require-jsdoc": "off",
        "semi-spacing": "error",
        "semi": "error",
        // "sort-keys": "off",
        // "sort-vars": "off",
        "space-before-blocks": "error",
        "space-before-function-paren": [
            "error",
            "never"
        ],
        "space-in-parens": "error",
        // "space-infix-ops": "off",
        "space-unary-ops": "error",
        // "spaced-comment": "off",
        "unicode-bom": [
            "error",
            "never"
        ],
        "wrap-regex": "error"
    }
};

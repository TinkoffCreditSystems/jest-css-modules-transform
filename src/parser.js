/* eslint-disable class-methods-use-this, prefer-named-capture-group */
const {extractICSS} = require('icss-utils');
const {camelCase, snakeCase} = require('lodash');
const postcss = require('postcss');
const process = require('process');

const REG_EXP_NAME_BREAK_CHAR = /[\s,.{/#[:]/;

module.exports = class Parser {
    constructor(cssLoaderConfig) {
        this._cssLoaderConfig = cssLoaderConfig;
    }

    getLocalIdent(path) {
        let localIdent;

        ['/src/', '/packages/', '/node_modules/', process.cwd()].forEach((marker) => {
            const index = path.indexOf(marker);
            if (undefined === localIdent && index > -1) {
                localIdent = path.substring(index + marker.length)
                    .replace(/(^[\W]*|_|\.\w+$)/g, '')
                    .replace(/[/\\]/g, '-');
            }
        });

        if (undefined === localIdent) {
            throw new Error(`Cannot create localIdent for the file: ${path}`);
        }

        return localIdent;
    }

    pushToResult({result, className, localIdent}) {
        const {exportLocalsStyle, useLocalIdent} = this._cssLoaderConfig || {};
        switch (exportLocalsStyle) {
            case 'camelCase':
                result[className] = className;
                result[camelCase(className)] = className;
                break;

            case 'camelCaseOnly':
                result[camelCase(className)] = className;
                break;

            case 'dashes':
                result[className] = className;
                result[snakeCase(className).replace(/_/g, '-')] = className;
                break;

            case 'dashesOnly':
                result[snakeCase(className).replace(/_/g, '-')] = className;
                break;

            default:
                result[className] = useLocalIdent ? `${localIdent}__${className}` : className;
        }
    }

    getCSSSelectors(css, path) {
        const end = css.length;
        let i = 0;
        let char;
        let bracketsCount = 0;
        const result = {};
        const resultAnimations = {};

        const localIdent = this.getLocalIdent(path);

        while (i < end) {
            if (i === -1) {
                throw Error(`Parse error ${path}`);
            }

            if (css.indexOf('/*', i) === i) {
                i = css.indexOf('*/', i + 2);

                // Unclosed comment. Break to avoid infinity loop
                if (i === -1) {
                    // Don't parse, but save collected result
                    return result;
                }

                continue;
            }

            char = css[i];

            if (char === '{') {
                bracketsCount++;
                i++;
                continue;
            }

            if (char === '}') {
                bracketsCount--;
                i++;
                continue;
            }

            if (char === '"' || char === '\'') {
                do {
                    i = css.indexOf(char, i + 1);
                    // Syntax error since this line. Don't parse, but save collected result
                    if (i === -1) {
                        return result;
                    }
                } while (css[i - 1] === '\\');
                i++;
                continue;
            }

            if (bracketsCount > 0) {
                i++;
                continue;
            }

            if (char === '.' || char === '#') {
                i++;
                const startWord = i;

                while (!REG_EXP_NAME_BREAK_CHAR.test(css[i])) {
                    i++;
                }
                const className = css.slice(startWord, i);

                this.pushToResult({result, className, localIdent});
                continue;
            }

            if (css.indexOf(':export', i) === i) {
                i += 7;
                continue;
            }

            if (css.indexOf('@keyframes', i) === i) {
                i += 10;
                while (REG_EXP_NAME_BREAK_CHAR.test(css[i])) {
                    i++;
                }

                const startWord = i;
                while (!REG_EXP_NAME_BREAK_CHAR.test(css[i])) {
                    i++;
                }

                const className = css.slice(startWord, i);

                this.pushToResult({result: resultAnimations, className, localIdent});
                continue;
            }

            i++;
        }

        return Object.assign(extractICSS(postcss.parse(css)).icssExports, result, resultAnimations);
    }
};

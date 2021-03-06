import {
  AST_NODE_TYPES,
  TSESTree,
} from '@typescript-eslint/experimental-utils';
import * as util from '../util';

export type Options = [('property' | 'method')?];
export type MessageIds = 'errorMethod' | 'errorProperty';

export default util.createRule<Options, MessageIds>({
  name: 'method-signature-style',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforces using a particular method signature syntax.',
      category: 'Best Practices',
      recommended: false,
    },
    fixable: 'code',
    messages: {
      errorMethod:
        'Shorthand method signature is forbidden. Use a function property instead.',
      errorProperty:
        'Function property signature is forbidden. Use a method shorthand instead.',
    },
    schema: [
      {
        enum: ['property', 'method'],
      },
    ],
  },
  defaultOptions: ['property'],

  create(context, [mode]) {
    const sourceCode = context.getSourceCode();

    function getMethodKey(
      node: TSESTree.TSMethodSignature | TSESTree.TSPropertySignature,
    ): string {
      let key = sourceCode.getText(node.key);
      if (node.computed) {
        key = `[${key}]`;
      }
      if (node.optional) {
        key = `${key}?`;
      }
      if (node.readonly) {
        key = `readonly ${key}`;
      }
      return key;
    }

    function getMethodParams(
      node: TSESTree.TSMethodSignature | TSESTree.TSFunctionType,
    ): string {
      let params = '()';
      if (node.params.length > 0) {
        const openingParen = util.nullThrows(
          sourceCode.getTokenBefore(node.params[0], util.isOpeningParenToken),
          'Missing opening paren before first parameter',
        );
        const closingParen = util.nullThrows(
          sourceCode.getTokenAfter(
            node.params[node.params.length - 1],
            util.isClosingParenToken,
          ),
          'Missing closing paren after last parameter',
        );

        params = sourceCode.text.substring(
          openingParen.range[0],
          closingParen.range[1],
        );
      }
      if (node.typeParameters != null) {
        const typeParams = sourceCode.getText(node.typeParameters);
        params = `${typeParams}${params}`;
      }
      return params;
    }

    function getMethodReturnType(
      node: TSESTree.TSMethodSignature | TSESTree.TSFunctionType,
    ): string {
      return sourceCode.getText(node.returnType!.typeAnnotation);
    }

    function getDelimiter(node: TSESTree.Node): string {
      const lastToken = sourceCode.getLastToken(node);
      if (
        lastToken &&
        (util.isSemicolonToken(lastToken) || util.isCommaToken(lastToken))
      ) {
        return lastToken.value;
      }

      return '';
    }

    return {
      TSMethodSignature(methodNode): void {
        if (mode === 'method') {
          return;
        }

        context.report({
          node: methodNode,
          messageId: 'errorMethod',
          fix: fixer => {
            const key = getMethodKey(methodNode);
            const params = getMethodParams(methodNode);
            const returnType = getMethodReturnType(methodNode);
            const delimiter = getDelimiter(methodNode);
            return fixer.replaceText(
              methodNode,
              `${key}: ${params} => ${returnType}${delimiter}`,
            );
          },
        });
      },
      TSPropertySignature(propertyNode): void {
        const typeNode = propertyNode.typeAnnotation?.typeAnnotation;
        if (typeNode?.type !== AST_NODE_TYPES.TSFunctionType) {
          return;
        }

        if (mode === 'property') {
          return;
        }

        context.report({
          node: propertyNode,
          messageId: 'errorProperty',
          fix: fixer => {
            const key = getMethodKey(propertyNode);
            const params = getMethodParams(typeNode);
            const returnType = getMethodReturnType(typeNode);
            const delimiter = getDelimiter(propertyNode);
            return fixer.replaceText(
              propertyNode,
              `${key}${params}: ${returnType}${delimiter}`,
            );
          },
        });
      },
    };
  },
});

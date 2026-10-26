// ADR-0010: no hardcoded style value. Appearance comes from token classes only.
const ARBITRARY = /(?:^|[\s"'`:!])-?[a-z][\w-]*-\[[^\]]*\]/; // bg-[#2563EB], p-[13px], md:w-[calc(...)]
const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\(/;

const noHardcodedStyle = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      arbitrary: 'Arbitrary Tailwind value forbidden: use a class from tokens.json (ADR-0010).',
      color: 'Hardcoded color forbidden: use a class from tokens.json (ADR-0010).',
      style: 'The style attribute is forbidden for appearance: use token classes (ADR-0010).',
    },
  },
  create(context) {
    const source = context.sourceCode;
    return {
      JSXAttribute(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : '';
        if (name === 'style') {
          context.report({ node, messageId: 'style' });
        } else if (name === 'className' && node.value) {
          const text = source.getText(node.value);
          if (ARBITRARY.test(text)) context.report({ node, messageId: 'arbitrary' });
          else if (COLOR.test(text)) context.report({ node, messageId: 'color' });
        }
      },
    };
  },
};

export default { rules: { 'no-hardcoded-style': noHardcodedStyle } };

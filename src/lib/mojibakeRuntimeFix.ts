import React from 'react';
import { Alert, Text, TextInput } from 'react-native';

type AnyProps = Record<string, unknown> | null | undefined;

const patchFlag = '__akylMojibakeRuntimeFixPatched';

const cp1251Extra: Record<string, number> = {
  '\u0402': 0x80,
  '\u0403': 0x81,
  '\u201A': 0x82,
  '\u0453': 0x83,
  '\u201E': 0x84,
  '\u2026': 0x85,
  '\u2020': 0x86,
  '\u2021': 0x87,
  '\u20AC': 0x88,
  '\u2030': 0x89,
  '\u0409': 0x8a,
  '\u2039': 0x8b,
  '\u040A': 0x8c,
  '\u040C': 0x8d,
  '\u040B': 0x8e,
  '\u040F': 0x8f,
  '\u0452': 0x90,
  '\u2018': 0x91,
  '\u2019': 0x92,
  '\u201C': 0x93,
  '\u201D': 0x94,
  '\u2022': 0x95,
  '\u2013': 0x96,
  '\u2014': 0x97,
  '\u2122': 0x99,
  '\u0459': 0x9a,
  '\u203A': 0x9b,
  '\u045A': 0x9c,
  '\u045C': 0x9d,
  '\u045B': 0x9e,
  '\u045F': 0x9f,
  '\u00A0': 0xa0,
  '\u040E': 0xa1,
  '\u045E': 0xa2,
  '\u0408': 0xa3,
  '\u00A4': 0xa4,
  '\u0490': 0xa5,
  '\u00A6': 0xa6,
  '\u00A7': 0xa7,
  '\u0401': 0xa8,
  '\u00A9': 0xa9,
  '\u0404': 0xaa,
  '\u00AB': 0xab,
  '\u00AC': 0xac,
  '\u00AD': 0xad,
  '\u00AE': 0xae,
  '\u0407': 0xaf,
  '\u00B0': 0xb0,
  '\u00B1': 0xb1,
  '\u0406': 0xb2,
  '\u0456': 0xb3,
  '\u0491': 0xb4,
  '\u00B5': 0xb5,
  '\u00B6': 0xb6,
  '\u00B7': 0xb7,
  '\u0451': 0xb8,
  '\u2116': 0xb9,
  '\u0454': 0xba,
  '\u00BB': 0xbb,
  '\u0458': 0xbc,
  '\u0405': 0xbd,
  '\u0455': 0xbe,
  '\u0457': 0xbf,
};

const mojibakePattern = /(?:[РС][\u0400-\u04ff\u00a0-\u00bf]|рџ|в[ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—™љ›њќћџњќ]|пё)/u;

function getCp1251Byte(char: string): number | null {
  const code = char.charCodeAt(0);

  if (code <= 0x7f) return code;
  if (code >= 0x80 && code <= 0x9f) return code;
  if (code >= 0x0410 && code <= 0x042f) return 0xc0 + (code - 0x0410);
  if (code >= 0x0430 && code <= 0x044f) return 0xe0 + (code - 0x0430);

  return cp1251Extra[char] ?? null;
}

function stringToCp1251Bytes(value: string): number[] | null {
  const bytes: number[] = [];

  for (const char of value) {
    const byte = getCp1251Byte(char);

    if (byte === null) {
      return null;
    }

    bytes.push(byte);
  }

  return bytes;
}

function decodeUtf8(bytes: number[]): string | null {
  let result = '';

  for (let index = 0; index < bytes.length; index += 1) {
    const first = bytes[index];

    if (first <= 0x7f) {
      result += String.fromCharCode(first);
      continue;
    }

    if (first >= 0xc2 && first <= 0xdf) {
      const second = bytes[index + 1];
      if ((second & 0xc0) !== 0x80) return null;
      result += String.fromCharCode(((first & 0x1f) << 6) | (second & 0x3f));
      index += 1;
      continue;
    }

    if (first >= 0xe0 && first <= 0xef) {
      const second = bytes[index + 1];
      const third = bytes[index + 2];
      if ((second & 0xc0) !== 0x80 || (third & 0xc0) !== 0x80) return null;
      result += String.fromCharCode(
        ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f),
      );
      index += 2;
      continue;
    }

    if (first >= 0xf0 && first <= 0xf4) {
      const second = bytes[index + 1];
      const third = bytes[index + 2];
      const fourth = bytes[index + 3];
      if (
        (second & 0xc0) !== 0x80 ||
        (third & 0xc0) !== 0x80 ||
        (fourth & 0xc0) !== 0x80
      ) {
        return null;
      }

      const codePoint =
        ((first & 0x07) << 18) |
        ((second & 0x3f) << 12) |
        ((third & 0x3f) << 6) |
        (fourth & 0x3f);

      result += String.fromCodePoint(codePoint);
      index += 3;
      continue;
    }

    return null;
  }

  return result;
}

export function decodeMojibakeText(value: string): string {
  if (!value || !mojibakePattern.test(value)) {
    return value;
  }

  const bytes = stringToCp1251Bytes(value);
  if (!bytes) return value;

  const decoded = decodeUtf8(bytes);
  if (!decoded || decoded === value) return value;
  if (/\uFFFD|[\u0000-\u001f\u007f-\u009f]/u.test(decoded)) return value;

  return decoded;
}

function decodeNode(node: unknown): unknown {
  if (typeof node === 'string') {
    return decodeMojibakeText(node);
  }

  if (Array.isArray(node)) {
    return node.map(decodeNode);
  }

  return node;
}

function cloneProps(props: AnyProps): Record<string, unknown> {
  return props ? { ...props } : {};
}

function decodeTextProps(props: AnyProps): Record<string, unknown> {
  const next = cloneProps(props);
  next.children = decodeNode(next.children);

  if (typeof next.accessibilityLabel === 'string') {
    next.accessibilityLabel = decodeMojibakeText(next.accessibilityLabel);
  }

  return next;
}

function decodeTextInputProps(props: AnyProps): Record<string, unknown> {
  const next = cloneProps(props);

  if (typeof next.placeholder === 'string') {
    next.placeholder = decodeMojibakeText(next.placeholder);
  }

  if (typeof next.accessibilityLabel === 'string') {
    next.accessibilityLabel = decodeMojibakeText(next.accessibilityLabel);
  }

  return next;
}

function patchRenderableComponent(
  component: unknown,
  transformProps: (props: AnyProps) => Record<string, unknown>,
) {
  const target = component as {
    [patchFlag]?: boolean;
    render?: (...args: unknown[]) => unknown;
    prototype?: { render?: (...args: unknown[]) => unknown; [patchFlag]?: boolean };
  };

  if (!target || target[patchFlag]) return;

  if (typeof target.render === 'function') {
    const originalRender = target.render;
    target.render = function patchedRender(props: AnyProps, ref: unknown) {
      return originalRender.call(this, transformProps(props), ref);
    };
    target[patchFlag] = true;
    return;
  }

  if (target.prototype && typeof target.prototype.render === 'function' && !target.prototype[patchFlag]) {
    const originalRender = target.prototype.render;
    target.prototype.render = function patchedPrototypeRender(this: { props?: AnyProps }) {
      const originalProps = this.props;
      this.props = transformProps(originalProps);

      try {
        return originalRender.call(this);
      } finally {
        this.props = originalProps;
      }
    };
    target.prototype[patchFlag] = true;
  }
}

function patchCreateElementFallback() {
  const reactWithFlag = React as typeof React & { [patchFlag]?: boolean };
  if (reactWithFlag[patchFlag]) return;

  const originalCreateElement = React.createElement;

  React.createElement = function patchedCreateElement(type, props, ...children) {
    if (type === Text) {
      return originalCreateElement(type, decodeTextProps({ ...(props || {}), children }), ...[]);
    }

    if (type === TextInput) {
      return originalCreateElement(type, decodeTextInputProps(props), ...children);
    }

    return originalCreateElement(type, props, ...children);
  } as typeof React.createElement;

  reactWithFlag[patchFlag] = true;
}

function patchAlert() {
  const alertWithFlag = Alert as typeof Alert & { [patchFlag]?: boolean };
  if (alertWithFlag[patchFlag]) return;

  const originalAlert = Alert.alert.bind(Alert);

  (Alert as any).alert = (
    title: string,
    message?: string,
    buttons?: Array<Record<string, unknown>>,
    options?: Record<string, unknown>,
  ) =>
    originalAlert(
      decodeMojibakeText(title),
      typeof message === 'string' ? decodeMojibakeText(message) : message,
      Array.isArray(buttons)
        ? buttons.map((button) => ({
            ...button,
            text:
              typeof button.text === 'string'
                ? decodeMojibakeText(button.text)
                : button.text,
          }))
        : buttons,
      options,
    );

  alertWithFlag[patchFlag] = true;
}

patchRenderableComponent(Text, decodeTextProps);
patchRenderableComponent(TextInput, decodeTextInputProps);
patchCreateElementFallback();
patchAlert();

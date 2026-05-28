import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { MarkdownLight } from './markdown-light';

function render(text: string): string {
  return renderToStaticMarkup(React.createElement(MarkdownLight, { text }));
}

describe('MarkdownLight', () => {
  it('renders **bold** as <strong>', () => {
    const html = render('Mange **2.2g de protéines/kg** par jour.');
    expect(html).toContain('<strong>2.2g de protéines/kg</strong>');
  });

  it('renders *italic* as <em>', () => {
    const html = render('C\'est *vraiment* important.');
    expect(html).toContain('<em>vraiment</em>');
  });

  it('renders `code` as styled code element', () => {
    const html = render('Tape `npm install` pour démarrer.');
    expect(html).toContain('<code');
    expect(html).toContain('npm install');
  });

  it('renders paragraphs separated by blank lines', () => {
    const html = render('Premier paragraphe.\n\nDeuxième paragraphe.');
    expect((html.match(/<p[^>]*>/g) ?? []).length).toBe(2);
  });

  it('renders bullet lists with - prefix', () => {
    const html = render('- Item 1\n- Item 2\n- Item 3');
    expect(html).toContain('<ul');
    expect((html.match(/<li/g) ?? []).length).toBe(3);
  });

  it('renders bullet lists with * prefix', () => {
    const html = render('* Item A\n* Item B');
    expect(html).toContain('<ul');
    expect((html.match(/<li/g) ?? []).length).toBe(2);
  });

  it('does not confuse *italic* with * bullet', () => {
    const html = render('Le *jeûne* est efficace.');
    expect(html).toContain('<em>jeûne</em>');
    expect(html).not.toContain('<ul');
  });

  it('handles empty input gracefully', () => {
    expect(render('')).toBe('');
  });

  it('mixed: bold + bullets + paragraph', () => {
    const html = render('Voici **3 règles** :\n\n- Protéines\n- Sommeil\n- Eau');
    expect(html).toContain('<strong>3 règles</strong>');
    expect(html).toContain('<ul');
    expect((html.match(/<li/g) ?? []).length).toBe(3);
  });

  it('does NOT inject HTML (XSS safe)', () => {
    const html = render('Coucou <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('ignores tech tags like <COACH_SAVE> and <COACH_PLAN_PATCH>', () => {
    const html = render('Texte avant.\n<COACH_SAVE>{"profile": {"objective": "lose_weight"}}</COACH_SAVE>\nTexte après.');
    expect(html).toContain('Texte avant.');
    expect(html).toContain('Texte après.');
    expect(html).not.toContain('COACH_SAVE');
    expect(html).not.toContain('lose_weight');
  });

  it('renders block code ``` correctly', () => {
    const html = render('Voici le code :\n```ts\nconst a = 1;\n```');
    expect(html).toContain('<pre');
    expect(html).toContain('const a = 1;');
  });

  it('renders h3 headings with specific border style', () => {
    const html = render('### Titre 3');
    expect(html).toContain('<h3');
    expect(html).toContain('border-b');
    expect(html).toContain('Titre 3');
  });
});

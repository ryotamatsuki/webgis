const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function createFeaturePopup(properties)');
const end = html.indexOf('function addLayer(geojson, name)', start);
assert.ok(start >= 0 && end > start, 'GeoJSON safe renderer is available');
const renderer = html.slice(start, end);
const createNode = (type) => ({
  type,
  textContent: '',
  children: [],
  append(...nodes) { this.children.push(...nodes); }
});
const document = {
  createElement: createNode,
  createTextNode: (text) => ({ type: '#text', textContent: text })
};
const helpers = new Function('document', renderer + '\nreturn { createFeaturePopup, escapeHTML };')(document);

test('malicious GeoJSON keys and values are rendered as literal text nodes', () => {
  const attack = '<img src=x onerror=alert(1)>';
  const popup = helpers.createFeaturePopup({ [attack]: attack });
  assert.equal(popup.type, 'div');
  assert.equal(popup.children[0].type, 'b');
  assert.equal(popup.children[0].textContent, attack + ':');
  assert.equal(popup.children[1].type, '#text');
  assert.equal(popup.children[1].textContent, ' ' + attack);
  assert.equal(popup.children[2].type, 'br');
  assert.equal(popup.children.some(node => node.type === 'img'), false);
});

test('label text escaping covers all HTML-significant characters', () => {
  assert.equal(
    helpers.escapeHTML('&<>"\x27'),
    '&amp;&lt;&gt;&quot;&#39;'
  );
  assert.equal(helpers.escapeHTML(null), '');
});

test('all GeoJSON popup and label sinks use safe rendering', () => {
  assert.equal((html.match(/layer\.bindPopup\(createFeaturePopup\(feature\.properties\)\)/g) || []).length, 5);
  assert.equal((html.match(/escapeHTML\(feature\.properties\?\.\[field\]\)/g) || []).length, 2);
  assert.doesNotMatch(html, /popup \+=/);
});

test('untrusted layer names are assigned via textContent', () => {
  assert.match(html, /name\.textContent = item\.name;/);
  assert.doesNotMatch(html, /<span>\$\{item\.name\}<\/span>/);
  assert.doesNotMatch(html, /onclick="toggleLayer/);
});
